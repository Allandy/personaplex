type ENV = {
  VITE_QUEUE_API_PATH: string;
  VITE_ENV: 'development' | 'production';
  VITE_OPENAI_API_KEY: string | undefined;
};

const parseEnv = (): ENV => {
  const VITE_QUEUE_API_PATH = import.meta.env.VITE_QUEUE_API_PATH;
  
  if (!VITE_QUEUE_API_PATH) {
    throw new Error("VITE_QUEUE_API_PATH is not defined");
  }

  return {
    VITE_QUEUE_API_PATH,
    VITE_ENV: import.meta.env.DEV ? 'development' : 'production',
    VITE_OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY,
  };
};

export const env = parseEnv();
