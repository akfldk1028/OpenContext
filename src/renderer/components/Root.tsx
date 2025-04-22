import React from 'react';
import {
  Box,
  Flex,
  Heading,
  Icon,
  HStack,
  VStack,
  Tooltip,
  useColorMode,
  useColorModeValue
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
  FiLogOut
} from 'react-icons/fi';
import Home from '../routes/Home';

// NavItem을 컴포넌트 바깥으로 이동
function NavItem({ icon, label, path, isActive, isExpanded, accentColor }: { icon: any, label: string, path: string, isActive: boolean, isExpanded: boolean, accentColor: string }) {
  return (
    <Tooltip label={!isExpanded ? label : undefined} placement="right" hasArrow>
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
    </Tooltip>
  );
}

export default function Root() {
  const { setColorMode } = useColorMode();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = React.useState(false);

  React.useEffect(() => {
    setColorMode('dark');
  }, [setColorMode]);

  const headerBg = useColorModeValue('gray.100', 'gray.900');
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

  const handleMouseEnter = React.useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    setIsExpanded(false);
  }, []);

  return (
    <Flex direction="row" minH="100vh" bg={mainBg}>
      {/* 사이드바 */}
      <Flex
        as="nav"
        direction="column"
        bg={sidebarBg}
        width={isExpanded ? "200px" : "70px"}
        py={4}
        borderRight="1px solid"
        borderColor="customBorder.dark"
        transition="width 0.3s ease"
        position="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* 로고 영역 */}
        <Flex align="center" justify={isExpanded ? "flex-start" : "center"} px={4} mb={6}>
          <Icon as={FiMonitor} color={accentColor} boxSize={6} />
          {isExpanded && (
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
              isExpanded={isExpanded}
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
              isExpanded={isExpanded}
              accentColor={accentColor}
            />
          ))}
        </VStack>
      </Flex>

      {/* 메인 콘텐츠 영역 */}
      <Flex direction="column" flex="1">
        {/* 헤더 */}
        <Box as="header" p={4} bg={headerBg} borderBottom="1px solid" borderColor="customBorder.dark">
          <HStack spacing={2}>
            <Heading size="md" color={accentColor}>MCP Control Panel</Heading>
          </HStack>
        </Box>

        {/* 메인 콘텐츠 */}
        <Box as="main" flex="1" p={4} bg={mainBg}>
          <Routes>
            <Route path="/" element={<Home />} />
            {/* 추가 라우트들을 여기에 정의 */}
          </Routes>
        </Box>

        {/* 푸터 */}
        <Box as="footer" p={3} bg={footerBg} textAlign="center" fontSize="sm" color={textColor} borderTop="1px solid" borderColor="customBorder.dark">
          © 2025 MCP Control System
        </Box>
      </Flex>
    </Flex>
  );
}
