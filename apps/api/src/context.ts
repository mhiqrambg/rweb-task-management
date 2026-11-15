import type { Config, Env } from './config';

export interface AppVariables {
  config: Config;
  requestId: string;
  userId: string | null;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };
