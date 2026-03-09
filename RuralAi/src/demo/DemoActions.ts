import { useEffect } from "react";

type DemoActionPayload = Record<string, any> | undefined;
type DemoActionHandler = (payload?: DemoActionPayload) => void | Promise<void>;
type DemoActionMap = Record<string, DemoActionHandler>;

const demoActionRegistry = new Map<string, DemoActionMap>();

export async function invokeDemoAction(
  screenKey: string,
  actionName: string,
  payload?: DemoActionPayload,
) {
  const actionMap = demoActionRegistry.get(screenKey);
  const action = actionMap?.[actionName];
  if (!action) {
    return false;
  }

  await action(payload);
  return true;
}

export function useDemoScreenActions(screenKey: string, actionMap: DemoActionMap) {
  useEffect(() => {
    demoActionRegistry.set(screenKey, actionMap);

    return () => {
      const registered = demoActionRegistry.get(screenKey);
      if (registered === actionMap) {
        demoActionRegistry.delete(screenKey);
      }
    };
  }, [actionMap, screenKey]);
}
