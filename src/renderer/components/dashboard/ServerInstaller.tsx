import React from 'react';
import {
  Box, HStack, Text, Select, Button, Icon, useColorModeValue
} from '@chakra-ui/react';
import { FiDownload } from 'react-icons/fi';

interface ServerInstallerProps {
  configSummaries: { id: string; name: string }[];
  selectedConfigId: string;
  onSelectConfig: (id: string) => void;
  onInstall: () => void;
}

const ServerInstaller: React.FC<ServerInstallerProps> = ({
  configSummaries,
  selectedConfigId,
  onSelectConfig,
  onInstall
}) => {
  const statBg = useColorModeValue('customCard.light', 'customCard.dark');
  const accentColor = useColorModeValue('customAccent.light', 'customAccent.dark');
  const cardBg = useColorModeValue('customCard.light', 'customCard.dark');

  return (
    <Box p={4} borderRadius="md" bg={statBg}>
      <Text fontWeight="medium" mb={3}>새 서버 설치</Text>
      <HStack spacing={4} w="full">
        <Select
          placeholder="서버 템플릿 선택"
          value={selectedConfigId}
          onChange={(e) => onSelectConfig(e.target.value)}
          bg={cardBg}
        >
          {configSummaries.map(cfg => (
            <option key={cfg.id} value={cfg.id}>{cfg.name}</option>
          ))}
        </Select>
        <Button
          leftIcon={<Icon as={FiDownload} />}
          color={accentColor}
          onClick={onInstall}
          disabled={!selectedConfigId}
          size="md"
        >
          설치
        </Button>
      </HStack>
    </Box>
  );
};

export default ServerInstaller;
