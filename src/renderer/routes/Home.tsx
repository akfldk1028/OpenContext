import React from 'react';
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Icon,
  Flex,
  Container,
  Card,
  CardHeader,
  CardBody,
  Badge,
  ButtonGroup,
  Button,
  Divider,
  Stack,
  useColorMode,
  useColorModeValue
} from '@chakra-ui/react';
import { FiActivity, FiServer, FiUsers, FiCpu, FiHardDrive, FiDatabase, FiSettings, FiRefreshCw } from 'react-icons/fi';

export default function Home() {
  console.log('Home component mounted');
  const { colorMode } = useColorMode();

  // 커스텀 테마 색상 적용
  const cardBg = useColorModeValue('customCard.light', 'customCard.dark');
  const accentColor = useColorModeValue('customAccent.light', 'customAccent.dark');
  const borderColor = useColorModeValue('customBorder.light', 'customBorder.dark');

  return (
    <Container maxW="container.xl" py={5}>
      <Heading mb={6} color={accentColor}>MCP Server Dashboard</Heading>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        <StatCard
          icon={FiServer}
          title="Server Status"
          value="Online"
          status="up"
          detail="Uptime: 3 days 4 hours"
          accentColor={accentColor}
          cardBg={cardBg}
          borderColor={borderColor}
        />

        <StatCard
          icon={FiCpu}
          title="CPU Usage"
          value="24%"
          status="down"
          detail="2% decrease from yesterday"
          accentColor={accentColor}
          cardBg={cardBg}
          borderColor={borderColor}
        />

        <StatCard
          icon={FiHardDrive}
          title="Memory Usage"
          value="4.2 GB"
          status="up"
          detail="0.8 GB increase"
          accentColor={accentColor}
          cardBg={cardBg}
          borderColor={borderColor}
        />

        <StatCard
          icon={FiUsers}
          title="Active Clients"
          value="37"
          status="up"
          detail="5 more than usual"
          accentColor={accentColor}
          cardBg={cardBg}
          borderColor={borderColor}
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" boxShadow="md">
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Heading size="md">Recent Logs</Heading>
              <Badge bg={accentColor} color="white">System Stable</Badge>
            </Flex>
          </CardHeader>
          <CardBody>
            <Stack spacing={3}>
              <LogItem time="10:42:15" level="info" message="Client #28 connected successfully" accentColor={accentColor} />
              <LogItem time="10:36:22" level="warning" message="High memory usage detected" accentColor={accentColor} />
              <LogItem time="10:30:18" level="info" message="Backup completed successfully" accentColor={accentColor} />
              <LogItem time="10:15:05" level="error" message="Failed to connect to database mirror" accentColor={accentColor} />
              <LogItem time="10:02:37" level="info" message="System update scheduled for 02:00 AM" accentColor={accentColor} />
            </Stack>
            <Divider my={3} borderColor={borderColor} />
            <Button size="sm" variant="outline" width="full" borderColor={accentColor} color={accentColor} _hover={{ bg: `${accentColor}20` }}>
              View All Logs
            </Button>
          </CardBody>
        </Card>

        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" boxShadow="md">
          <CardHeader>
            <Heading size="md">Quick Actions</Heading>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={2} spacing={4}>
              <ActionButton icon={FiRefreshCw} text="Restart Server" accentColor={accentColor} />
              <ActionButton icon={FiDatabase} text="Backup Data" accentColor={accentColor} />
              <ActionButton icon={FiActivity} text="View Performance" accentColor={accentColor} />
              <ActionButton icon={FiUsers} text="Manage Clients" accentColor={accentColor} />
            </SimpleGrid>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* 추가 섹션: 서버 설정 */}
      <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" boxShadow="md" mt={6}>
        <CardHeader>
          <Flex justify="space-between" align="center">
            <Heading size="md">Server Configuration</Heading>
            <Button size="sm" leftIcon={<Icon as={FiSettings} />} bg={accentColor} color="white" _hover={{ bg: `${accentColor}90` }}>
              Edit Settings
            </Button>
          </Flex>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <ConfigItem label="Server Name" value="MCP-MAIN-01" accentColor={accentColor} />
            <ConfigItem label="Environment" value="Production" accentColor={accentColor} />
            <ConfigItem label="Version" value="v2.4.8" accentColor={accentColor} />
            <ConfigItem label="Database" value="PostgreSQL 14.0" accentColor={accentColor} />
            <ConfigItem label="Last Update" value="2025-04-15 08:30 AM" accentColor={accentColor} />
            <ConfigItem label="Scheduled Backup" value="Daily at 01:00 AM" accentColor={accentColor} />
          </SimpleGrid>
        </CardBody>
      </Card>
    </Container>
  );
}

// 상태 카드 컴포넌트
function StatCard({ icon, title, value, status, detail, accentColor, cardBg, borderColor }) {
  return (
    <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" boxShadow="md">
      <CardBody>
        <Flex align="center" mb={2}>
          <Icon as={icon} boxSize={6} color={accentColor} />
          <Text ml={2} fontWeight="medium">{title}</Text>
        </Flex>
        <Stat>
          <StatNumber fontSize="2xl">{value}</StatNumber>
          <StatHelpText>
            <StatArrow type={status} color={status === "up" ? accentColor : "gray.500"} />
            {detail}
          </StatHelpText>
        </Stat>
      </CardBody>
    </Card>
  );
}

// 로그 항목 컴포넌트
function LogItem({ time, level, message, accentColor }) {
  const colors = {
    info: `${accentColor}`,
    warning: "orange.400",
    error: "red.400"
  };

  return (
    <Flex align="center">
      <Text fontSize="sm" color="gray.500" width="70px">{time}</Text>
      <Badge bg={level === "info" ? accentColor : colors[level]} color="white" mr={2}>{level}</Badge>
      <Text flex="1" fontSize="sm">{message}</Text>
    </Flex>
  );
}

// 액션 버튼 컴포넌트
function ActionButton({ icon, text, accentColor }) {
  return (
    <Button
      bg={`${accentColor}10`}
      color={accentColor}
      borderColor={accentColor}
      borderWidth="1px"
      leftIcon={<Icon as={icon} />}
      _hover={{ bg: `${accentColor}20` }}
    >
      {text}
    </Button>
  );
}

// 설정 항목 컴포넌트
function ConfigItem({ label, value, accentColor }) {
  return (
    <Box p={3} borderRadius="md" bg={`${accentColor}05`} borderColor={`${accentColor}20`} borderWidth="1px">
      <Text fontSize="sm" fontWeight="medium" color={accentColor} mb={1}>{label}</Text>
      <Text fontSize="md">{value}</Text>
    </Box>
  );
}
