/**
 * Unit tests for Logistics – transport.js
 */

const { haversineDistance, estimateTransportCost, getVehicleTypes } = require('../../lambdas/logistics/transport');

describe('Transport Module', () => {
    describe('haversineDistance', () => {
        test('should calculate distance between Delhi and Mumbai', () => {
            // Delhi: 28.6139, 77.2090, Mumbai: 19.0760, 72.8777
            const distance = haversineDistance(28.6139, 77.2090, 19.0760, 72.8777);
            // ~1150 km
            expect(distance).toBeGreaterThan(1100);
            expect(distance).toBeLessThan(1200);
        });

        test('should return 0 for same coordinates', () => {
            const distance = haversineDistance(23.0, 78.0, 23.0, 78.0);
            expect(distance).toBeCloseTo(0, 5);
        });

        test('should calculate distance between Indore and Bhopal', () => {
            // Indore: 22.7196, 75.8577, Bhopal: 23.2599, 77.4126
            const distance = haversineDistance(22.7196, 75.8577, 23.2599, 77.4126);
            // ~180 km
            expect(distance).toBeGreaterThan(150);
            expect(distance).toBeLessThan(210);
        });
    });

    describe('estimateTransportCost', () => {
        test('should estimate cost with coordinates', () => {
            const cost = estimateTransportCost(
                { lat: 22.72, lng: 75.86, state: 'MP' },
                { lat: 23.26, lng: 77.41, state: 'MP' },
                2000, 'truck'
            );
            // 180km * 25 + 1500 base = ~6000
            expect(cost).toBeGreaterThan(4000);
            expect(cost).toBeLessThan(8000);
        });

        test('should estimate higher cost for inter-state', () => {
            const intraState = estimateTransportCost(
                { state: 'MP' }, { state: 'MP' }, 1000, 'truck'
            );
            const interState = estimateTransportCost(
                { state: 'MP' }, { state: 'MH' }, 1000, 'truck'
            );
            expect(interState).toBeGreaterThan(intraState);
        });

        test('should add weight surcharge for heavy loads', () => {
            const normalLoad = estimateTransportCost(
                { state: 'MP' }, { state: 'MP' }, 3000, 'truck'
            );
            const heavyLoad = estimateTransportCost(
                { state: 'MP' }, { state: 'MP' }, 8000, 'truck'
            );
            expect(heavyLoad).toBeGreaterThan(normalLoad);
        });

        test('tractor should be cheaper than truck per km', () => {
            const tractorCost = estimateTransportCost(
                { state: 'MP' }, { state: 'MP' }, 1000, 'tractor'
            );
            const truckCost = estimateTransportCost(
                { state: 'MP' }, { state: 'MP' }, 1000, 'truck'
            );
            expect(tractorCost).toBeLessThan(truckCost);
        });
    });

    describe('getVehicleTypes', () => {
        test('should return all vehicle types', () => {
            const vehicles = getVehicleTypes();
            expect(vehicles).toHaveLength(5);
            expect(vehicles.map(v => v.type)).toEqual(
                expect.arrayContaining(['tractor', 'pickup', 'mini-truck', 'truck', 'tempo'])
            );
        });

        test('each vehicle should have capacity and cost', () => {
            const vehicles = getVehicleTypes();
            for (const v of vehicles) {
                expect(v.capacity_kg).toBeGreaterThan(0);
                expect(v.cost_per_km).toBeGreaterThan(0);
                expect(v.description).toBeTruthy();
            }
        });
    });
});
