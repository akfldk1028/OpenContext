import React, { useState, useEffect } from 'react';
import {
  Box, Button, Container, Heading, Icon,
  SimpleGrid, Spinner, Stack, Text, useColorModeValue, VStack, HStack, Badge, Select
} from '@chakra-ui/react';
import { FiDownload, FiRefreshCw, FiPower, FiPause } from 'react-icons/fi';

type ServerStatus = { name: string; online: boolean; pingMs?: number };

// Home 컴포넌트 props 타입 정의
interface HomeProps {
  addLog: (message: string) => void; // Root에서 전달받는 로그 추가 함수
}

export default function Home({ addLog }: HomeProps) { // props로 addLog 받기
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(false);
  // const [logs, setLogs] = useState<string[]>([]); // Root로 이동
  const [processingServer, setProcessingServer] = useState<string | null>(null);
  const api = (window as any).api;
  const accent = useColorModeValue('blue.600', 'blue.300');
  const [configSummaries, setConfigSummaries] = useState<{ id: string; name: string }[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');

  const fetchConfigs = async () => {
    try {
      const list = await api.getConfigSummaries();
      setConfigSummaries(Array.isArray(list) ? list : []);
    } catch (e) {
      addLog(`Error fetching configs: ${String(e)}`); // setLogs 대신 addLog 사용
    }
  };

  const fetchServers = async () => {
    setLoading(true);
    try {
      const list = await api.getServers();
      setServers(Array.isArray(list) ? list : []);
    } catch (e) {
      addLog(`Error fetching servers: ${String(e)}`); // setLogs 대신 addLog 사용
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchServers();

    // 서버 상태 업데이트 구독 (로그 관련 로직은 Root.tsx에서 처리)
    const offServers = api.onServersUpdated((list: ServerStatus[]) => {
      setServers(Array.isArray(list) ? list : []);
      setProcessingServer(null);
    });

    // 설치 진행/결과 구독 리스너는 Root.tsx로 이동했으므로 여기서는 제거
    // const offProg = ...
    // const offRes = ...

    return () => {
      offServers();
      // offProg(); // 제거
      // offRes(); // 제거
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 초기 로드 시 한 번만 실행

  const onInstall = () => {
    if (!selectedConfigId) return;
    // setLogs([]); // Root에서 로그 관리하므로 여기서 초기화 불필요
    addLog(`🚀 '${selectedConfigId}' 서버 설치 시작...`); // 설치 시작 로그 추가
    api.installServer(selectedConfigId);
  };

  const onStartServer = (serverName: string) => {
    setProcessingServer(serverName);
    addLog(`🔄 '${serverName}' 서버 시작 중...`); // setLogs 대신 addLog 사용
    api.startServer(serverName);
  };

  const onStopServer = (serverName: string) => {
    setProcessingServer(serverName);
    addLog(`🔄 '${serverName}' 서버 중지 중...`); // setLogs 대신 addLog 사용
    api.stopServer(serverName);
  };

  return (
    <Container py={8} maxH="100%" overflowY="auto"> {/* 여기에 최대 높이와 스크롤 설정 */}
      <VStack spacing={6} align="stretch">
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

        {/* 로그 출력 영역 제거 (Root.tsx의 오른쪽 사이드바로 이동) */}
        {/*
        <Box w="full" maxH="200px" overflowY="auto" p={4} bg="gray.50" rounded="md">
          <Stack spacing={1}>
            {logs.length
              ? logs.map((msg, i) => <Text key={i} fontSize="sm">{msg}</Text>)
              : <Text fontSize="sm" color="gray.500">로깅 대기 중...</Text>
            }
          </Stack>
        </Box>
        */}

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
