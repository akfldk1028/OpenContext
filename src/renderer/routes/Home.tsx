import React, { useState, useEffect } from 'react';
import {
  Box, Button, Container, Heading, Icon,
  SimpleGrid, Spinner, Stack, Text, useColorModeValue, VStack
} from '@chakra-ui/react';
import { FiDownload, FiRefreshCw } from 'react-icons/fi';

type ServerStatus = { name: string; online: boolean; pingMs?: number };

export default function Home() {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const accent = useColorModeValue('blue.600', 'blue.300');

  const fetchServers = async () => {
    setLoading(true);
    try {
      const list = await window.api.getServers();
      setServers(Array.isArray(list) ? list : []);
    } catch (e) {
      setLogs(l => [...l, `Error fetching: ${String(e)}`]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();

    // subscribe to updated lists
    const offServers = window.api.onServersUpdated((list: ServerStatus[]) => {
      setServers(Array.isArray(list) ? list : []);
    });

    // subscribe to install progress
    const offProg = window.api.onInstallProgress(({ serverName, status, percent }) => {
      setLogs(l => [...l, `🔄 ${serverName}: ${status} (${percent}%)`]);
    });

    // subscribe to install results
    const offRes = window.api.onInstallResult(({ success, message, installDir }) => {
      setLogs(l => [
        ...l,
        `Result: ${message}`,
        installDir ? `→ 설치 경로: ${installDir}` : ''
      ]);
      if (success) fetchServers();
    });

    return () => {
      offServers();
      offProg();
      offRes();
    };
  }, []);

  const onInstall = () => {
    setLogs([]);
    window.api.installServer('qdrant-server');
  };

  return (
    <Container py={8}>
      <VStack spacing={6}>
        <Heading color={accent}>MCP 자동설치 테스트</Heading>

        {loading && <Spinner size="xl" />}

        <Button
            size="lg"
            leftIcon={<Icon as={FiDownload} />}
            colorScheme="blue"
            onClick={onInstall}
          >
            Qdrant 서버 설치
          </Button>
        {!loading && servers.length > 0 && (
          <Button
            size="md"
            leftIcon={<Icon as={FiRefreshCw} />}
            onClick={fetchServers}
          >
            서버 목록 새로고침 ({servers.length})
          </Button>
        )}

        <Box w="full" maxH="200px" overflowY="auto" p={4} bg="gray.50" rounded="md">
          <Stack spacing={1}>
            {logs.length
              ? logs.map((msg, i) => <Text key={i} fontSize="sm">{msg}</Text>)
              : <Text fontSize="sm" color="gray.500">로깅 대기 중...</Text>
            }
          </Stack>
        </Box>

        <Box w="full">
          <Text fontWeight="bold">서버 상태</Text>
          <SimpleGrid columns={2} spacing={4}>
            {servers.map(srv => (
              <Text key={srv.name}>
                {srv.name}: {srv.online ? '🟢 Online' : '🔴 Offline'}
                {srv.pingMs != null && ` (ping ${srv.pingMs}ms)`}
              </Text>
            ))}
          </SimpleGrid>
        </Box>
      </VStack>
    </Container>
  );
}