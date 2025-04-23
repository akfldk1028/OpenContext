import React from 'react';
import {
  Flex, Image, Text, Switch, Badge, useColorModeValue,
  Box
} from '@chakra-ui/react';


interface ClientToggleCardProps {
  clientType: string;
  isConnected: boolean;
  clientInfo: ClientInfo;
  onToggle: (enabled: boolean) => void;
}
interface ClientInfo {
  name: string;
  logo: string | React.ReactNode; // Accept both string and React component
  color: string;
}

const ClientToggleCard: React.FC<ClientToggleCardProps> = ({
  clientType,
  isConnected,
  clientInfo,
  onToggle
}) => {
  const cardBg = useColorModeValue('customCard.light', 'customCard.dark');
  const borderColor = useColorModeValue('customBorder.light', 'customBorder.dark');

  return (
    <Flex
      direction="column"
      align="center"
      p={3}
      borderWidth="1px"
      borderRadius="md"
      borderColor={borderColor}
      bg={cardBg}
      transition="all 0.2s"
      position="relative"
      _hover={{ boxShadow: "md" }}
    >
      {typeof clientInfo.logo === 'string' ? (
        <Image
          src={clientInfo.logo}
          boxSize="32px"
          borderRadius="full"
          mb={2}
          opacity={isConnected ? 1 : 0.6}
        />
      ) : (
        <Box
          as="div"
          boxSize="32px"
          mb={2}
          opacity={isConnected ? 1 : 0.6}
        >
          {clientInfo.logo}
        </Box>
      )}
      <Text
        fontSize="sm"
        fontWeight="medium"
        color={isConnected ? `${clientInfo.color}.600` : "gray.500"}
        mb={2}
      >
        {clientInfo.name}
      </Text>
      <Switch
        colorScheme={clientInfo.color}
        isChecked={isConnected}
        onChange={(e) => onToggle(e.target.checked)}
        size="sm"
      />

      {isConnected && (
        <Badge
          position="absolute"
          top="-8px"
          right="-8px"
          colorScheme={clientInfo.color}
          borderRadius="full"
          px={2}
          fontSize="xs"
        >
          활성
        </Badge>
      )}
    </Flex>
  );
};

export default ClientToggleCard;
