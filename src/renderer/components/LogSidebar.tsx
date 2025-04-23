import React from 'react';
import {
  Box,
  Flex,
  Heading,
  Stack,
  Text,
  useColorModeValue,
  IconButton, // 토글 버튼을 위해 추가될 수 있음 (여기서는 Root에서 제어)
} from '@chakra-ui/react';
// import { FiX } from 'react-icons/fi'; // 닫기 버튼용 아이콘 예시

interface LogSidebarProps {
  logs: string[];
  accentColor: string;
  isOpen: boolean; // 접기/펼치기 상태
  // onClose?: () => void; // 닫기 버튼 핸들러 (옵션)
}

export default function LogSidebar({ logs, accentColor, isOpen }: LogSidebarProps) {
  const logBg = useColorModeValue('gray.50', 'gray.850');
  const borderColor = useColorModeValue('gray.200', 'customBorder.dark');

  return (
    <Flex
      direction="column"
      width={isOpen ? { base: "100%", md: "300px", lg: "350px" } : "0"} // isOpen 상태에 따라 너비 조절
      minWidth={isOpen ? { base: "100%", md: "300px", lg: "350px" } : "0"} // flex 아이템 축소 방지
      bg={logBg}
      borderLeft={isOpen ? "1px solid" : "none"} // 열려 있을 때만 테두리 표시
      borderColor={borderColor}
      p={isOpen ? 4 : 0} // 열려 있을 때만 패딩 적용
      overflow="hidden" // 내용이 넘치지 않도록
      transition="width 0.3s ease, min-width 0.3s ease, padding 0.3s ease" // 애니메이션 효과
      // position={{ base: 'absolute', md: 'relative' }} // 작은 화면에서는 앱솔루트 (옵션)
      // right={0} // 작은 화면 앱솔루트 시 위치
      // height={{ base: '50%', md: 'auto'}} // 작은 화면 앱솔루트 시 높이 (옵션)
      // zIndex={5} // 다른 요소와의 z 순서
    >
      {isOpen && ( // isOpen 상태일 때만 내부 컨텐츠 렌더링
        <>
          {/* 헤더 (닫기 버튼 포함 가능) */}
          <Flex justify="space-between" align="center" mb={4}>
            <Heading size="sm" color={accentColor}>Log</Heading>
            {/* <IconButton
              aria-label="Close log sidebar"
              icon={<FiX />}
              size="sm"
              variant="ghost"
              onClick={onClose} // 닫기 핸들러 연결
            /> */}
          </Flex>

          {/* 로그 내용 */}
          <Box flex="1" overflowY="auto" pr={2} /* 스크롤바 공간 확보 */ >
            <Stack spacing={1}>
              {logs.length
                ? logs.map((msg, i) => (
                    <Text key={i} fontSize="xs" fontFamily="monospace" whiteSpace="pre-wrap" /* 줄바꿈 처리 */ >
                      {msg}
                    </Text>
                  ))
                : <Text fontSize="sm" color="gray.500">로깅 대기 중...</Text>
              }
            </Stack>
          </Box>
        </>
      )}
    </Flex>
  );
}
