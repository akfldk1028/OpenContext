import React, { ReactNode } from 'react';
import { Box, useColorModeValue } from '@chakra-ui/react';
// import './styles/globalStyles.css';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const bg = useColorModeValue('gray.50', 'gray.900');

  return (
    <Box
      // minHeight="100vh"
      bg={bg}
      transition="background-color 0.2s"
    >
      {children}
    </Box>
  );
};

export default AppLayout;
