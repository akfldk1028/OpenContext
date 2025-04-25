import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  Icon,
  HStack,
  VStack,
  Tooltip,
  useColorMode,
  useColorModeValue,
  Stack,
  Text,
  IconButton,
} from '@chakra-ui/react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  FiMonitor,
  FiHome,
  FiSettings,
  FiServer,
  FiDatabase,
  FiUsers,
  FiActivity,
  FiPieChart,
  FiHelpCircle,
  FiLogOut,
  FiSidebar,
  FiChevronsRight,
  FiChevronsLeft,
} from 'react-icons/fi';
import Home from '../routes/Home';
import LogSidebar from './LogSidebar';
import { ToastProvider } from '../components/Toast/ToastManager';

// NavItem을 컴포넌트 바깥으로 이동
function NavItem({ icon, label, path, isActive, isExpanded, accentColor }: { icon: any, label: string, path: string, isActive: boolean, isExpanded: boolean, accentColor: string }) {
  return (
      <Flex
        as={Link}
        to={path}
        p={3}
        mx={2}
        borderRadius="md"
        align="center"
        bg={isActive ? `${accentColor}20` : "transparent"}
        color={isActive ? accentColor : "gray.400"}
        _hover={{ bg: `${accentColor}10`, color: isActive ? accentColor : "gray.200" }}
        transition="all 0.2s"
      >
        <Icon as={icon} boxSize={5} />
        {isExpanded && <Box ml={3}>{label}</Box>}
      </Flex>
  );
}

export default function Root() {
  const { setColorMode } = useColorMode();
  const location = useLocation();
  const [isNavExpanded, setIsNavExpanded] = React.useState(false);
  const [isLogSidebarOpen, setIsLogSidebarOpen] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const api = (window as any).api;

  React.useEffect(() => {
    setColorMode('dark');
  }, [setColorMode]);

  useEffect(() => {
    if (!api) return;

    const offServers = api.onServersUpdated((list: any[]) => {
      // 서버 목록 업데이트 로직은 Home 등 필요한 컴포넌트에서 처리
      // 여기서는 로그만 추가 (필요하다면)
    });

    const offProg = api.onInstallProgress((prog: any) => {
      const { serverName, status, percent } = prog;
      setLogs(l => [...l, `🔄 ${serverName}: ${status} (${percent}%)`]);
    });

    const offRes = api.onInstallResult((res: any) => {
      const { success, message, serverName } = res;
      setLogs(l => [
        ...l,
        `${serverName} 설치 결과: ${message}`
      ]);
      // 성공 시 서버 목록 갱신은 Home에서 처리해야 함
    });

    const offServerLog = api.onServerLog((log: string) => {
       setLogs(l => [...l, log]);
    });
    // 서버 시작 결과 리스너 추가
    const offStartRes = api.onServerStartResult((res: any) => {
      // 결과 객체 구조를 확인하고 필요에 따라 조정하세요.
      const message = res?.message || (res?.success ? '성공' : '실패');
      const serverName = res?.serverName || '알 수 없는 서버';
      setLogs(l => [...l, `✅ ${serverName} 시작 결과: ${message}`]);
    });

    // 서버 중지 결과 리스너 추가
    const offStopRes = api.onServerStopResult((res: any) => {
      // 결과 객체 구조를 확인하고 필요에 따라 조정하세요.
      const message = res?.message || (res?.success ? '성공' : '실패');
      const serverName = res?.serverName || '알 수 없는 서버';
      setLogs(l => [...l, `🛑 ${serverName} 중지 결과: ${message}`]);
    });

    // 제거 관련 리스너 추가 (만약 필요하다면)
    const offUninstallProg = api.onUninstallProgress((prog: any) => {
      const { serverName, status, percent } = prog;
      setLogs(l => [...l, `🗑️ ${serverName} 제거 중: ${status} (${percent}%)`]);
    });

    const offUninstallRes = api.onUninstallResult((res: any) => {
      const { success, message, serverName } = res;
      setLogs(l => [
        ...l,
        `${serverName} 제거 결과: ${message}`
      ]);
    });
    // Claude Desktop 연결 요청 결과 리스너
    const offClaudeResult = api.onClaudeConnectionResult((res: any) => {
      const { success, serverName, message } = res;
      setLogs(l => [...l, `${success ? '✅' : '❌'} ${serverName}: ${message}`]);
    });

    // Claude Desktop 연결 요청 리스너
    const offAskClaudeConnection = api.onAskClaudeConnection((data: any) => {
      const { serverName } = data;
      setLogs(l => [...l, `🔄 ${serverName}: Claude Desktop 연결 확인 중...`]);
    });


    return () => {
      offServers();
      offProg();
      offRes();
      offServerLog();
      offStartRes(); // 리스너 해제
      offStopRes(); // 리스너 해제
      offUninstallProg(); // 리스너 해제
      offUninstallRes(); // 리스너 해제
      offClaudeResult();
      offAskClaudeConnection();
    };
  }, [api]);
  const cardBg = useColorModeValue('customCard.light', 'customCard.dark');

  const headerBg = useColorModeValue('customCard.light', 'customCard.dark');
  const footerBg = useColorModeValue('gray.50', 'gray.800');
  const mainBg = useColorModeValue('customBg.light', 'customBg.dark');
  const accentColor = useColorModeValue('customAccent.light', 'customAccent.dark');
  const textColor = useColorModeValue('customText.light', 'customText.dark');
  const sidebarBg = useColorModeValue('gray.200', 'gray.900');

  // 네비게이션 아이템 정의
  const navItems = [
    { icon: FiHome, label: "대시보드", path: "/" },
    { icon: FiServer, label: "서버", path: "/server" },
    { icon: FiDatabase, label: "데이터베이스", path: "/database" },
    { icon: FiUsers, label: "사용자", path: "/users" },
    { icon: FiActivity, label: "모니터링", path: "/monitoring" },
    { icon: FiPieChart, label: "통계", path: "/statistics" },
    { icon: FiSettings, label: "설정", path: "/settings" },
  ];

  // 하단 네비게이션 아이템
  const bottomNavItems = [
    { icon: FiHelpCircle, label: "도움말", path: "/help" },
    { icon: FiLogOut, label: "로그아웃", path: "/logout" },
  ];

  const handleNavMouseEnter = React.useCallback(() => {
    setIsNavExpanded(true);
  }, []);

  const handleNavMouseLeave = React.useCallback(() => {
    setIsNavExpanded(false);
  }, []);

  const toggleLogSidebar = () => {
    setIsLogSidebarOpen(!isLogSidebarOpen);
  };

  const addLog = (message: string) => {
    setLogs(l => [...l, message]);
  };

  return (
    <ToastProvider>

    <Flex direction="row" minH="100vh" bg={mainBg}>
      {/* 왼쪽 네비게이션 사이드바 */}
      <Flex
        as="nav"
        direction="column"
        bg={cardBg}
        width={isNavExpanded ? "200px" : "70px"}
        py={4}
        borderRight="1px solid"
        borderColor="customBorder.dark"
        transition="width 0.3s ease"
        position="relative"
        onMouseEnter={handleNavMouseEnter}
        onMouseLeave={handleNavMouseLeave}
        zIndex={10}
      >
        {/* 로고 영역 */}
        <Flex align="center" justify={isNavExpanded ? "flex-start" : "center"} px={4} mb={6}>
          <Icon as={FiMonitor} color={accentColor} boxSize={6} />
          {isNavExpanded && (
            <Heading size="sm" ml={2} color={accentColor}>MCP Panel</Heading>
          )}
        </Flex>

        {/* 메인 메뉴 아이템들 */}
        <VStack spacing={1} align="stretch" flex="1">
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path}
              isActive={location.pathname === item.path}
              isExpanded={isNavExpanded}
              accentColor={accentColor}
            />
          ))}
        </VStack>

        {/* 하단 메뉴 아이템들 */}
        <Box borderTop="1px solid" borderColor="customBorder.dark" my={2} opacity={0.4} />
        <VStack spacing={1} align="stretch" mt={2}>
          {bottomNavItems.map((item) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path}
              isActive={location.pathname === item.path}
              isExpanded={isNavExpanded}
              accentColor={accentColor}
            />
          ))}
        </VStack>
      </Flex>

      {/* 메인 콘텐츠 + 오른쪽 사이드바 영역 */}
    <Flex direction="row" flex="1" overflow="hidden"> {/* overflow: hidden 추가 */}
      {/* 메인 콘텐츠 영역 */}
      <Flex direction="column" flex="1" overflow="hidden"> {/* overflow: hidden 추가 */}
        {/* 헤더 */}
        <Flex as="header" p={4} bg={headerBg} borderBottom="1px solid" borderColor="customBorder.dark" justify="space-between" align="center">
          <Heading size="md" color={accentColor}>MCP Control Panel</Heading>
          <Tooltip label={isLogSidebarOpen ? "로그 숨기기" : "로그 보기"} placement="bottom">
            <IconButton
              aria-label={isLogSidebarOpen ? "Hide Logs" : "Show Logs"}
              icon={<Icon as={isLogSidebarOpen ? FiChevronsRight : FiChevronsLeft} />}
              onClick={toggleLogSidebar}
              variant="ghost"
              size="md"
              color={accentColor}
            />
          </Tooltip>
        </Flex>

        {/* 메인 콘텐츠 - 여기를 수정 */}
        <Box as="main" flex="1" p={4} bg={mainBg} overflowY="auto">
          <Routes>
            <Route path="/" element={<Home addLog={addLog} />} />
            {/* 추가 라우트들을 여기에 정의 */}
          </Routes>
        </Box>

        {/* 푸터 */}
        <Box as="footer" p={3} bg={footerBg} textAlign="center" fontSize="sm" color={textColor} borderTop="1px solid" borderColor="customBorder.dark">
          © 2025 MCP Control System
        </Box>
      </Flex>

      {/* 오른쪽 로그 사이드바 */}
      <LogSidebar
        logs={logs}
        accentColor={accentColor}
        isOpen={isLogSidebarOpen}
      />
    </Flex>
    </Flex>
    </ToastProvider>

  );
}
