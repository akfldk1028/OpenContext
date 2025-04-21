// import { createRoot } from 'react-dom/client';
// import App from './App';
//
// const container = document.getElementById('root') as HTMLElement;
// const root = createRoot(container);
// root.render(<App />);
//
// // calling IPC exposed from preload script
// window.electron.ipcRenderer.once('ipc-example', (arg) => {
//   // eslint-disable-next-line no-console
//   console.log(arg);
// });
// window.electron.ipcRenderer.sendMessage('ipc-example', ['ping']);



import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import theme from './theme';
import Root from './components/Root';
import { HashRouter } from 'react-router-dom';

const client = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback="loading">
      <QueryClientProvider client={client}>
        <ChakraProvider theme={theme}>
          <ColorModeScript initialColorMode={theme.config.initialColorMode} />
            <HashRouter>
              <Root />
            </HashRouter>
        </ChakraProvider>
      </QueryClientProvider>
    </Suspense>
  </React.StrictMode>
);
