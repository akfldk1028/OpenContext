import React from 'react';
import {
  Box, Text, useColorModeValue
} from '@chakra-ui/react';

interface ServerAvatarProps {
  name: string;
  color?: string;
  onClick?: () => void;
}

const ServerAvatar: React.FC<ServerAvatarProps> = ({
  name,
  color = 'purple',
  onClick
}) => {
  // 서버 이름에서 이니셜 추출 (최대 2글자)
  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // 랜덤 색상 배정 (서버 이름 기반)
  const getColorFromName = (name: string) => {
    const colors = [
      'purple.500', 'blue.500', 'green.500', 'red.500',
      'orange.500', 'pink.500', 'teal.500', 'cyan.500'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const bgColor = color === 'auto' ? getColorFromName(name) : `${color}.500`;
  const textColor = 'white';
  const initials = getInitials(name);

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg={bgColor}
      color={textColor}
      borderRadius="md"
      width="48px"
      height="48px"
      fontSize="18px"
      fontWeight="bold"
      cursor={onClick ? "pointer" : "default"}
      onClick={onClick}
      boxShadow="md"
      transition="all 0.2s"
      _hover={{
        transform: onClick ? 'scale(1.05)' : 'none',
        boxShadow: onClick ? 'lg' : 'md'
      }}
    >
      <Text>{initials}</Text>
    </Box>
  );
};

export default ServerAvatar;
