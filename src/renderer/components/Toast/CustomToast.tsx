// src/renderer/components/CustomToast.tsx
import React, { useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  CloseButton,
  useDisclosure,
  Slide,
  Icon,
  useColorModeValue
} from '@chakra-ui/react';
import { FiInfo, FiCheck, FiAlertTriangle, FiX } from 'react-icons/fi';

interface CustomToastProps {
  title: string;
  description?: string;
  status: 'info' | 'success' | 'warning' | 'error';
  duration?: number; // 밀리초 단위
  onClose?: () => void;
  isClosable?: boolean;
}

const statusIconMap = {
  info: FiInfo,
  success: FiCheck,
  warning: FiAlertTriangle,
  error: FiX
};

const CustomToast: React.FC<CustomToastProps> = ({
  title,
  description,
  status = 'info',
  duration = 5000,
  onClose,
  isClosable = true
}) => {
  const { isOpen, onClose: handleClose } = useDisclosure({ defaultIsOpen: true });

  // 아이콘 선택
  const ToastIcon = statusIconMap[status];

  // 상태에 따른 색상 설정
  const bgColor = useColorModeValue(
    {
      info: 'blue.50',
      success: 'green.50',
      warning: 'orange.50',
      error: 'red.50'
    }[status],
    {
      info: 'blue.900',
      success: 'green.900',
      warning: 'orange.900',
      error: 'red.900'
    }[status]
  );

  const borderColor = {
    info: 'blue.300',
    success: 'green.300',
    warning: 'orange.300',
    error: 'red.300'
  }[status];

  const iconColor = {
    info: 'blue.500',
    success: 'green.500',
    warning: 'orange.500',
    error: 'red.500'
  }[status];

  const textColor = useColorModeValue('gray.800', 'white');

  // 자동 닫힘 타이머
  // 자동 닫힘 타이머 부분 확인
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        handleClose();
        if (onClose) onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, handleClose, onClose]);

  return (
    <Slide
      direction="bottom"
      in={isOpen}
      style={{ position: 'fixed', bottom: 4, right: 4, zIndex: 9999 }}
    >
      <Box
        maxWidth="sm"
        bg={bgColor}
        boxShadow="md"
        rounded="md"
        overflow="hidden"
        border="1px solid"
        borderColor={borderColor}
        transition="all 0.3s"
        _hover={{ boxShadow: 'lg' }}
      >
        <Flex p={4}>
          <Box mr={4} mt={1}>
            <Icon as={ToastIcon} color={iconColor} boxSize={5} />
          </Box>
          <Box flex="1">
            <Text fontWeight="bold" color={textColor}>{title}</Text>
            {description && (
              <Text fontSize="sm" color={textColor} opacity={0.9} mt={1}>
                {description}
              </Text>
            )}
          </Box>
          {isClosable && (
            <CloseButton
              size="sm"
              color={textColor}
              onClick={() => {
                handleClose();
                if (onClose) onClose();
              }}
            />
          )}
        </Flex>
      </Box>
    </Slide>
  );
};

export default CustomToast;
