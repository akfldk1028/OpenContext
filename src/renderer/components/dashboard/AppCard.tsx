import React from 'react';
import {
  Box, Flex, Image, Text, Badge, useColorModeValue
} from '@chakra-ui/react';

interface AppCardProps {
  appType: string;
  appInfo: {
    name: string;
    logo: string;
    color: string;
  };
  isConnected: boolean;
  onToggle: () => void;
}

const AppCard: React.FC<AppCardProps> = ({
  appType,
  appInfo,
  isConnected,
  onToggle
}) => {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box
      p={4}
      cursor="pointer"
      onClick={onToggle}
      transition="all 0.2s"
      _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
    >
      <Flex
        direction="column"
        align="center"
        transition="all 0.3s ease"
        _hover={{
          '& > img': {
            opacity: 1
          }
        }}
      >
        <Image
          src={appInfo.logo}
          alt={appInfo.name}
          boxSize="48px"
          mb={2}
          opacity={isConnected ? 1 : 0.2}
          transition="opacity 0.3s ease"
        />
        <Text fontWeight="medium">{appInfo.name}</Text>

        {isConnected && (
          <Badge colorScheme={appInfo.color} mt={2}>
            연결됨
          </Badge>
        )}
      </Flex>
    </Box>
  );
};

export default AppCard;
