import React, { useState, useEffect } from 'react';
import {
  Container, Heading, SimpleGrid, Spinner, VStack, Box,
  Text, Flex, Card, CardHeader, CardBody, IconButton,
  useColorModeValue
} from '@chakra-ui/react';
import {
  FiServer, FiDatabase, FiSettings, FiLink, FiRefreshCw
} from 'react-icons/fi';

// 컴포넌트 임포트
import StatCard from '../components/server/StatCard';
import ServerCard from '../components/server/ServerCard';
import ServerInstaller from '../components/dashboard/ServerInstaller';
import AppCard from "@/renderer/components/dashboard/AppCard";
import audacity from "@/renderer/assets/audacity-icon.svg";
import medium from "@/renderer/assets/medium-logo-icon.svg";
import huggingface from "@/renderer/assets/huggingface-icon.svg";



type ServerStatus = { name: string; online: boolean; pingMs?: number };

interface ServerClientSettings {
  serverName: string;
  openai: boolean;
  claude: boolean;
  general: boolean;
}

interface HomeProps {
  addLog: (message: string) => void;
}

// 타입 확장: AIClientType에 새 앱 유형 추가
type AIClientType = 'openai' | 'claude' | 'general' | 'google_drive' | 'slack' | 'notion' | 'github';

// 앱 정보 객체 추가
const appInfo = {
  openai: {
    name: 'medium',
    logo: medium,
    color: 'gray'
  },
  claude: {
    name: 'huggingface',
    logo: huggingface,
    color: 'gray'
  },
  google_drive: {
    name: 'Google Drive',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/175px-Google_Drive_icon_%282020%29.svg.png',
    color: 'gray'
  },
  slack: {
    name: 'Slack',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/2048px-Slack_icon_2019.svg.png',
    color: 'gray'
  },
  notion: {
    name: 'Notion',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png',
    color: 'gray'
  },
  github: {
    name: 'GitHub',
    logo: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    color: 'gray'
  },
  dropbox: {
    name: 'audacity',
    logo: audacity,
    color: 'gray'
  },
  jira: {
    name: 'Jira',
    logo: 'https://cdn.worldvectorlogo.com/logos/jira-1.svg',
    color: 'gray'
  },
  trello: {
    name: 'Trello',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Trello-logo-blue.svg/2560px-Trello-logo-blue.svg.png',
    color: 'gray'
  },
  asana: {
    name: 'Asana',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Asana_logo.svg/1200px-Asana_logo.svg.png',
    color: 'gray'
  }
};
export default function Home({ addLog }: HomeProps) {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingServer, setProcessingServer] = useState<string | null>(null);
  const [clientSettings, setClientSettings] = useState<ServerClientSettings[]>([]);
  const api = (window as any).api;
  const [configSummaries, setConfigSummaries] = useState<{ id: string; name: string }[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');

  // 테마 색상
  const accent = useColorModeValue('customAccent.light', 'customAccent.dark');
  const borderColor = useColorModeValue('customBorder.light', 'customBorder.dark');
  const cardBg = useColorModeValue('customCard.light', 'customCard.dark');
  const accentColor = useColorModeValue('customAccent.light', 'customAccent.dark');




  const fetchConfigs = async () => {
    try {
      const list = await api.getConfigSummaries();
      setConfigSummaries(Array.isArray(list) ? list : []);
    } catch (e) {
      addLog(`Error fetching configs: ${String(e)}`);
    }
  };

  const fetchServers = async () => {
    setLoading(true);
    try {
      const list = await api.getServers();
      setServers(Array.isArray(list) ? list : []);

      // 초기 클라이언트 설정 생성 (없는 서버만)
      const newSettings = [...clientSettings];

      list.forEach(srv => {
        const existingSetting = newSettings.find(s => s.serverName === srv.name);
        if (!existingSetting) {
          newSettings.push({
            serverName: srv.name,
            openai: false,
            claude: false,
            general: false
          });
        }
      });

      setClientSettings(newSettings);
    } catch (e) {
      addLog(`Error fetching servers: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchServers();

    const offServers = api.onServersUpdated((list: ServerStatus[]) => {
      setServers(Array.isArray(list) ? list : []);
      setProcessingServer(null);
    });

    return () => {
      offServers();
    };
  }, []);

  const onInstall = () => {
    if (!selectedConfigId) return;
    addLog(`🚀 '${selectedConfigId}' 서버 설치 시작...`);
    api.installServer(selectedConfigId);
  };

  const onStartServer = (serverName: string) => {
    setProcessingServer(serverName);
    addLog(`🔄 '${serverName}' 서버 시작 중...`);
    api.startServer(serverName);
  };

  const onStopServer = (serverName: string) => {
    setProcessingServer(serverName);
    addLog(`🔄 '${serverName}' 서버 중지 중...`);
    api.stopServer(serverName);
  };

  // 클라이언트 연결 토글
  const toggleClient = (serverName: string, clientType: AIClientType, enabled: boolean) => {
    const settingsIndex = clientSettings.findIndex(s => s.serverName === serverName);
    if (settingsIndex === -1) return;

    const newSettings = [...clientSettings];
    newSettings[settingsIndex] = {
      ...newSettings[settingsIndex],
      [clientType]: enabled
    };

    setClientSettings(newSettings);

    const action = enabled ? '연결됨' : '연결 해제됨';
    // addLog(`${serverName} 서버와 ${clientInfo[clientType].name} 클라이언트 ${action}`);
  };

  // 특정 서버의 클라이언트 설정 가져오기
  const getServerClientSettings = (serverName: string) => {
    return clientSettings.find(s => s.serverName === serverName) || {
      serverName,
      openai: false,
      claude: false,
      general: false
    };
  };

  // 활성 연결 수 계산
  const getActiveConnectionCount = () => {
    return clientSettings.reduce((count, setting) => {
      return count + (setting.openai ? 1 : 0) + (setting.claude ? 1 : 0) + (setting.general ? 1 : 0);
    }, 0);
  };

  // 온라인 서버 수 계산
  const getOnlineServerCount = () => {
    return servers.filter(s => s.online).length;
  };

  return (
    <Container maxW="container.xl" py={5} overflowY="auto" maxH="100%">
      <Heading mb={6} color={accent}>MCP Server DashBoard</Heading>

      {/* 상태 카드 섹션 */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        <StatCard
          icon={FiServer}
          title="서버 상태"
          value={`${getOnlineServerCount()}/${servers.length}`}
          helpText="서버 온라인"
          showArrow={true}
          arrowType="increase"
        />

        <StatCard
          icon={FiLink}
          title="AI 연결"
          value={getActiveConnectionCount()}
          helpText="활성 연결"
          showArrow={true}
          arrowType="increase"
        />

        <StatCard
          icon={FiDatabase}
          title="설치 가능"
          value={configSummaries.length}
          helpText="서버 템플릿"
        />

        <StatCard
          icon={FiSettings}
          title="시스템 상태"
          value="정상"
          badge="안정적"
          badgeColor="green"
        />
      </SimpleGrid>

      {/* 서버 관리 섹션 */}
      <Card  boxShadow="md" mb={6} bg={cardBg}>
    <Box mt={8}>
    <SimpleGrid columns={{ base: 2, md: 3, lg: 5 }} spacing={4}>
      {Object.entries(appInfo).map(([appType, info]) => (
        <AppCard
          key={appType}
          appType={appType}
          appInfo={info}
          isConnected={false}
          onToggle={() => {/* 앱 연결 토글 핸들러 */}}
        />
      ))}
    </SimpleGrid>
</Box>
        <CardBody>
          {loading ? (
            <Flex justify="center" py={10}>
              <Spinner size="xl" color={accent} />
            </Flex>
          ) : (
            <VStack spacing={4} align="stretch">
              {/* 서버 설치 컴포넌트 */}
              <ServerInstaller
                configSummaries={configSummaries}
                selectedConfigId={selectedConfigId}
                onSelectConfig={setSelectedConfigId}
                onInstall={onInstall}
              />

              {/* 서버 목록 */}
              {servers.length > 0 ? (
                <SimpleGrid columns={1} spacing={4}>
                  {servers.map(srv => (
                    <ServerCard
                      key={srv.name}
                      server={srv}
                      settings={getServerClientSettings(srv.name)}
                      isProcessing={processingServer === srv.name}
                      onStart={onStartServer}
                      onStop={onStopServer}
                      onToggleClient={toggleClient}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <Box p={5} borderWidth="1px" borderRadius="md" borderStyle="dashed" textAlign="center">
                  <Text color="gray.500">설치된 서버가 없습니다. 위 선택 메뉴에서 서버를 설치해 보세요.</Text>
                </Box>
              )}
            </VStack>
          )}
        </CardBody>
      </Card>
    </Container>
  );
}
