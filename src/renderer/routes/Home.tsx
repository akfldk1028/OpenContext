import React, { useState, useEffect } from 'react';
import {
  Box, Button, Container, Heading, Icon,
  SimpleGrid, Spinner, Stack, Text, useColorModeValue, VStack, HStack, Badge, Select
} from '@chakra-ui/react';
import { FiDownload, FiRefreshCw, FiPower, FiPause } from 'react-icons/fi';

type ServerStatus = { name: string; online: boolean; pingMs?: number };

export default function Home() {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [processingServer, setProcessingServer] = useState<string | null>(null);
  // Preload API 참조 (any로 캐스트)
  const api = (window as any).api;
  const accent = useColorModeValue('blue.600', 'blue.300');
  // 서버 Config 요약 정보 및 선택 상태
  const [configSummaries, setConfigSummaries] = useState<{ id: string; name: string }[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');

  // Config 요약 불러오기
  const fetchConfigs = async () => {
    try {
      const list = await api.getConfigSummaries();
      setConfigSummaries(Array.isArray(list) ? list : []);
    } catch (e) {
      setLogs(l => [...l, `Error fetching configs: ${String(e)}`]);
    }
  };

  const fetchServers = async () => {
    setLoading(true);
    try {
      const list = await api.getServers();
      setServers(Array.isArray(list) ? list : []);
    } catch (e) {
      setLogs(l => [...l, `Error fetching: ${String(e)}`]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchServers();

    // 서버 상태 업데이트 구독
    const offServers = api.onServersUpdated((list: ServerStatus[]) => {
      setServers(Array.isArray(list) ? list : []);
      setProcessingServer(null); // 작업 완료 시 처리 중인 서버 상태 초기화
    });

    // 설치 진행 상황 구독
    const offProg = api.onInstallProgress((prog: any) => {
      const { serverName, status, percent } = prog;
      setLogs(l => [...l, `🔄 ${serverName}: ${status} (${percent}%)`]);
    });

    // 설치 결과 구독
    const offRes = api.onInstallResult((res: any) => {
      const { success, message, serverName } = res;
      setLogs(l => [
        ...l,
        `${serverName} 설치 결과: ${message}`
      ]);
      if (success) fetchServers();
    });

    return () => {
      offServers();
      offProg();
      offRes();
    };
  }, []);

  // 설치 핸들러: 선택된 Config ID로 설치
  const onInstall = () => {
    if (!selectedConfigId) return;
    setLogs([]);
    api.installServer(selectedConfigId);
  };

  // 서버 시작
  const onStartServer = (serverName: string) => {
    setProcessingServer(serverName);
    setLogs(l => [...l, `🔄 '${serverName}' 서버 시작 중...`]);
    api.startServer(serverName);
  };

  // 서버 중지
  const onStopServer = (serverName: string) => {
    setProcessingServer(serverName);
    setLogs(l => [...l, `🔄 '${serverName}' 서버 중지 중...`]);
    api.stopServer(serverName);
  };

  return (
    <Container py={8}>
      <VStack spacing={6}>
        <Heading color={accent}>MCP 서버 관리</Heading>

        {loading && <Spinner size="xl" />}

        {/* 서버 선택 및 설치 */}
        <HStack spacing={4} w="full">
          <Select
            placeholder="서버 선택"
            value={selectedConfigId}
            onChange={e => setSelectedConfigId(e.target.value)}
          >
            {configSummaries.map(cfg => (
              <option key={cfg.id} value={cfg.id}>{cfg.name}</option>
            ))}
          </Select>
          <Button
            size="lg"
            leftIcon={<Icon as={FiDownload} />}
            colorScheme="blue"
            onClick={onInstall}
            disabled={!selectedConfigId}
          >
            설치
          </Button>
        </HStack>
        
        {!loading && servers.length > 0 && (
          <Button
            size="md"
            leftIcon={<Icon as={FiRefreshCw} />}
            onClick={fetchServers}
          >
            서버 목록 새로고침 ({servers.length})
          </Button>
        )}

        {/* 로그 출력 영역 */}
        <Box w="full" maxH="200px" overflowY="auto" p={4} bg="gray.50" rounded="md">
          <Stack spacing={1}>
            {logs.length
              ? logs.map((msg, i) => <Text key={i} fontSize="sm">{msg}</Text>)
              : <Text fontSize="sm" color="gray.500">로깅 대기 중...</Text>
            }
          </Stack>
        </Box>

        {/* 서버 상태 목록 */}
        <Box w="full">
          <Text fontWeight="bold" mb={3}>서버 상태</Text>
          <SimpleGrid columns={1} spacing={4}>
            {servers.map(srv => (
              <Box 
                key={srv.name} 
                p={3} 
                borderWidth="1px" 
                borderRadius="md" 
                borderColor={srv.online ? "green.200" : "gray.200"}
                bg={srv.online ? "green.50" : "gray.50"}
              >
                <HStack justify="space-between">
                  <HStack>
                    <Badge colorScheme={srv.online ? "green" : "gray"} py={1} px={2} borderRadius="md">
                      {srv.online ? '실행 중' : '중지됨'}
                    </Badge>
                    <Text fontWeight="medium">{srv.name}</Text>
                  </HStack>
                  
                  <HStack>
                    {!srv.online ? (
                      <Button
                        size="sm"
                        leftIcon={<Icon as={FiPower} />}
                        colorScheme="green"
                        onClick={() => onStartServer(srv.name)}
                        isLoading={processingServer === srv.name}
                        loadingText="시작 중..."
                      >
                        시작
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        leftIcon={<Icon as={FiPause} />}
                        colorScheme="red"
                        onClick={() => onStopServer(srv.name)}
                        isLoading={processingServer === srv.name}
                        loadingText="중지 중..."
                      >
                        중지
                      </Button>
                    )}
                  </HStack>
                </HStack>
              </Box>
            ))}
            
            {servers.length === 0 && !loading && (
              <Box p={5} borderWidth="1px" borderRadius="md" borderStyle="dashed" textAlign="center">
                <Text color="gray.500">설치된 서버가 없습니다. 위 버튼으로 서버를 설치해 보세요.</Text>
              </Box>
            )}
          </SimpleGrid>
        </Box>
      </VStack>
    </Container>
  );
}