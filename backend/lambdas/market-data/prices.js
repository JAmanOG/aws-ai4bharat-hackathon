/**
 * Market Data Lambda – prices.js
 * Market price data, trends, and e-NAM integration.
 * Satisfies Req 5.4: Display current market prices and historical price trends.
 */

const { query } = require('../../utils/db');

/**
 * Get current prices for a crop across mandis.
 */
async function getCurrentPrices(cropType, filters = {}) {
    const { state, district, limit = 20 } = filters;
    let sql = `SELECT * FROM market_prices WHERE crop_type = $1 AND trade_date >= CURRENT_DATE - INTERVAL '7 days'`;
    const params = [cropType];
    let i = 2;

    if (state) { sql += ` AND state = $${i++}`; params.push(state); }
    if (district) { sql += ` AND district = $${i++}`; params.push(district); }

    sql += ` ORDER BY trade_date DESC, modal_price DESC LIMIT $${i++}`;
    params.push(limit);

    const result = await query(sql, params);

    // Calculate summary stats
    const prices = result.rows;
    const modalPrices = prices.map(p => parseFloat(p.modal_price)).filter(p => p > 0);
    const summary = modalPrices.length > 0 ? {
        avgPrice: (modalPrices.reduce((a, b) => a + b, 0) / modalPrices.length).toFixed(2),
        minPrice: Math.min(...modalPrices).toFixed(2),
        maxPrice: Math.max(...modalPrices).toFixed(2),
        totalMandis: new Set(prices.map(p => p.mandi_name)).size,
    } : null;

    return { crop_type: cropType, prices, summary };
}

/**
 * Get historical price trend for a crop.
 */
async function getPriceTrend(cropType, options = {}) {
    const { mandi_code, state, days = 30 } = options;
    let sql = `SELECT trade_date, 
             AVG(modal_price) as avg_modal, 
             MIN(min_price) as min_price, 
             MAX(max_price) as max_price,
             SUM(arrival_qty) as total_arrival_qty,
             COUNT(DISTINCT mandi_name) as mandi_count
             FROM market_prices 
             WHERE crop_type = $1 AND trade_date >= CURRENT_DATE - $2::int * INTERVAL '1 day'`;
    const params = [cropType, days];
    let i = 3;

    if (mandi_code) { sql += ` AND mandi_code = $${i++}`; params.push(mandi_code); }
    if (state) { sql += ` AND state = $${i++}`; params.push(state); }

    sql += ' GROUP BY trade_date ORDER BY trade_date ASC';

    const result = await query(sql, params);

    // Calculate trend direction
    const trend = result.rows;
    let trendDirection = 'stable';
    if (trend.length >= 2) {
        const first = parseFloat(trend[0].avg_modal);
        const last = parseFloat(trend[trend.length - 1].avg_modal);
        const change = ((last - first) / first) * 100;
        if (change > 5) trendDirection = 'rising';
        else if (change < -5) trendDirection = 'falling';
    }

    return {
        crop_type: cropType,
        period_days: days,
        trend: trendDirection,
        data_points: trend,
    };
}

/**
 * Get prices across all crops at a specific mandi.
 */
async function getMandiPrices(mandiName) {
    const result = await query(
        `SELECT * FROM market_prices 
     WHERE mandi_name = $1 AND trade_date >= CURRENT_DATE - INTERVAL '7 days'
     ORDER BY crop_type, trade_date DESC`,
        [mandiName]
    );

    // Group by crop
    const byCrop = {};
    for (const row of result.rows) {
        if (!byCrop[row.crop_type]) byCrop[row.crop_type] = [];
        byCrop[row.crop_type].push(row);
    }

    return {
        mandi_name: mandiName,
        state: result.rows[0]?.state,
        district: result.rows[0]?.district,
        crops: byCrop,
        total_crops: Object.keys(byCrop).length,
    };
}

/**
 * Get list of available mandis.
 */
async function getMandis(state = null) {
    let sql = `SELECT DISTINCT mandi_name, mandi_code, state, district,
             COUNT(DISTINCT crop_type) as crop_count,
             MAX(trade_date) as latest_data
             FROM market_prices`;
    const params = [];

    if (state) {
        sql += ' WHERE state = $1';
        params.push(state);
    }

    sql += ' GROUP BY mandi_name, mandi_code, state, district ORDER BY state, mandi_name';
    const result = await query(sql, params);
    return result.rows;
}

/**
 * Detect significant price changes for notification triggers.
 * Returns crops where modal price changed >10% in the last 2 days.
 * Satisfies Req 5.6: Send push notifications for significant price changes.
 */
async function detectPriceChanges(thresholdPercent = 10) {
    const result = await query(`
    WITH recent AS (
      SELECT crop_type, mandi_name, state, modal_price, trade_date,
             LAG(modal_price) OVER (PARTITION BY crop_type, mandi_name ORDER BY trade_date) as prev_price
      FROM market_prices
      WHERE trade_date >= CURRENT_DATE - INTERVAL '3 days'
    )
    SELECT crop_type, mandi_name, state, modal_price, prev_price,
           ROUND(((modal_price - prev_price) / NULLIF(prev_price,0)) * 100, 2) as change_percent
    FROM recent
    WHERE prev_price IS NOT NULL
      AND ABS((modal_price - prev_price) / NULLIF(prev_price,0)) * 100 > $1
    ORDER BY ABS(change_percent) DESC
  `, [thresholdPercent]);

    return result.rows.map(row => ({
        ...row,
        direction: parseFloat(row.change_percent) > 0 ? 'up' : 'down',
        alert_message: `${row.crop_type} price ${parseFloat(row.change_percent) > 0 ? 'up' : 'down'} ${Math.abs(row.change_percent)}% at ${row.mandi_name}`,
    }));
}

/**
 * Ingest new price data (from e-NAM scraper / manual entry).
 */
async function ingestPriceData(priceRecords) {
    const inserted = [];
    for (const record of priceRecords) {
        try {
            const result = await query(
                `INSERT INTO market_prices
         (crop_type, variety, mandi_name, mandi_code, state, district,
          min_price, max_price, modal_price, price_unit, arrival_qty, trade_date, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT ON CONSTRAINT idx_prices_unique DO UPDATE
         SET min_price = EXCLUDED.min_price, max_price = EXCLUDED.max_price,
             modal_price = EXCLUDED.modal_price, arrival_qty = EXCLUDED.arrival_qty
         RETURNING id`,
                [record.crop_type, record.variety, record.mandi_name, record.mandi_code,
                record.state, record.district, record.min_price, record.max_price,
                record.modal_price, record.price_unit || 'quintal', record.arrival_qty,
                record.trade_date || new Date(), record.source || 'manual']
            );
            inserted.push(result.rows[0]);
        } catch (err) {
            console.error('Price ingest error:', err.message, record);
        }
    }
    return { inserted: inserted.length, total: priceRecords.length };
}

module.exports = {
    getCurrentPrices, getPriceTrend, getMandiPrices, getMandis,
    detectPriceChanges, ingestPriceData,
};
