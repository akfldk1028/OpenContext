// src/renderer/components/ToastManager.tsx 파일 생성
import React, { useState, useEffect, createContext, useContext } from 'react';
import { Box } from '@chakra-ui/react';
import CustomToast from './CustomToast';

// 토스트 타입 정의
interface Toast {
  id: string;
  title: string;
  description?: string;
  status: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  isClosable?: boolean;
}

// 토스트 컨텍스트 정의
interface ToastContextType {
  toast: (options: Omit<Toast, 'id'>) => string;
  closeToast: (id: string) => void;
  closeAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// 토스트 컨텍스트 사용을 위한 훅
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// 토스트 프로바이더 컴포넌트
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ToastManager.tsx에서 toast 함수 수정
  const toast = (options: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    // 기본 지속 시간 5초로 설정
    const defaultedOptions = {
      ...options,
      duration: options.duration || 5000
    };

    setToasts(prev => [...prev, { ...defaultedOptions, id }]);
    return id;
  };

  // 특정 토스트 닫기
  const closeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // 모든 토스트 닫기
  const closeAll = () => {
    setToasts([]);
  };

  return (
    <ToastContext.Provider value={{ toast, closeToast, closeAll }}>
      {children}
      <Box
        position="fixed"
        bottom={4}
        right={4}
        zIndex={9999}
      >
        {toasts.map(t => (
          <Box key={t.id} mb={3}>
            <CustomToast
              title={t.title}
              description={t.description}
              status={t.status}
              duration={t.duration}
              isClosable={t.isClosable}
              onClose={() => closeToast(t.id)}
            />
          </Box>
        ))}
      </Box>
    </ToastContext.Provider>
  );
};
