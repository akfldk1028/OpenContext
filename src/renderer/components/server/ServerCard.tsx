import React from 'react';
import {
  Box, Card, CardBody, Flex, HStack, VStack, Icon, Text, Badge, Button, Grid, useColorModeValue
} from '@chakra-ui/react';
import { FiServer, FiPause, FiPower, FiLink } from 'react-icons/fi';
import ClientToggleCard, { ClientInfo } from './ClientToggleCard';
import ClaudeLogo from "@/renderer/assets/claude-ai-icon.svg";
import OpenAILogo from "@/renderer/assets/chatgpt-icon.svg";
import PerplexityLogo from "@/renderer/assets/google-gemini-icon.svg";


interface ServerStatus {
  name: string;
  online: boolean;
  pingMs?: number;
}

interface ServerClientSettings {
  serverName: string;
  openai: boolean;
  claude: boolean;
  general: boolean;
}

interface ServerCardProps {
  server: ServerStatus;
  settings: ServerClientSettings;
  clientInfo: {
    openai: ClientInfo;
    claude: ClientInfo;
    general: ClientInfo;
  };
  isProcessing: boolean;
  onStart: (serverName: string) => void;
  onStop: (serverName: string) => void;
  onToggleClient: (serverName: string, clientType: string, enabled: boolean) => void;
}

interface ClientInfo {
  name: string;
  logo: string | React.ReactNode; // Accept both string and React component
  color: string;
}

 // 클라이언트 정보

const ServerCard: React.FC<ServerCardProps> = ({
  server,
  settings,
  isProcessing,
  onStart,
  onStop,
  onToggleClient
}) => {
  const borderColor = useColorModeValue('customBorder.light', 'customBorder.dark');
  const cardBg = useColorModeValue('customCard.light', 'customCard.dark');
  const accentColor = useColorModeValue('customAccent.light', 'customAccent.dark');
  const clientInfo = {
    openai: {
      name: 'OpenAI',
      logo: OpenAILogo,
      color: 'green'
    },
    claude: {
      name: 'Claude',
      logo: ClaudeLogo,
      color: 'purple'
    },
    general: {
      name: '일반',
      logo: PerplexityLogo,
      color: 'blue'
    }
  };
  return (
    <Card
      borderWidth="1px"
      borderColor={server.online ? accentColor : borderColor}
      borderRadius="lg"
      overflow="hidden"
      bg={cardBg}
    >
      <Box
        w="100%"
      />
      <CardBody p={0} >
        {/* 서버 정보 헤더 */}
        <Flex
          p={4}
          justify="space-between"
          align="center"
          borderBottomWidth="1px"
          borderBottomColor={borderColor}
        >
          <HStack>
            <Icon
              as={FiServer}
              color={server.online ?accentColor : accentColor} // 켜기(시작) 버튼은 accentColor 사용
              boxSize={5}
            />
            <VStack align="start" spacing={0}>
              <Text fontWeight="bold">{server.name}</Text>
              <Badge
                colorScheme={server.online ? accentColor : "gray"}
                variant="subtle"
              >
                {server.online ? '실행 중' : '중지됨'}
              </Badge>
            </VStack>
          </HStack>

          {/* 여기서 시작 버튼 색상을 동적으로 결정합니다 */}
          <Button
            size="sm"
            leftIcon={<Icon as={server.online ? FiPause : FiPower} />}
            bg={server.online ? "red.500" : accentColor} // 켜기(시작) 버튼은 accentColor 사용
            color="white"
            _hover={{
              bg: server.online ? "red.600" : accentColor
            }}
            onClick={() => server.online ? onStop(server.name) : onStart(server.name)}
            isLoading={isProcessing}
            loadingText={server.online ? "중지 중..." : "시작 중..."}
          >
            {server.online ? '중지' : '시작'}
          </Button>
        </Flex>

        {/* 클라이언트 연결 섹션 */}
        <Box p={4} >
          <Grid templateColumns="repeat(3, 1fr)" gap={3} >
            {/* OpenAI */}
            <ClientToggleCard
              clientType="openai"
              isConnected={settings.openai}
              clientInfo={clientInfo.openai}
              onToggle={(enabled) => onToggleClient(server.name, 'openai', enabled)}
            />

            {/* Claude */}
            <ClientToggleCard
              clientType="claude"
              isConnected={settings.claude}
              clientInfo={clientInfo.claude}
              onToggle={(enabled) => onToggleClient(server.name, 'claude', enabled)}
            />

            {/* 일반 */}
            <ClientToggleCard
              clientType="general"
              isConnected={settings.general}
              clientInfo={clientInfo.general}
              onToggle={(enabled) => onToggleClient(server.name, 'general', enabled)}
            />
          </Grid>
        </Box>
      </CardBody>
    </Card>
  );
};

export default ServerCard;
