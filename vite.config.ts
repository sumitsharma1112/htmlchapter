import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `--mode https` serves a self-signed certificate so phones on the LAN can use camera/mic
// (browsers only expose getUserMedia on HTTPS or localhost).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'https' ? [basicSsl()] : [],
}));
