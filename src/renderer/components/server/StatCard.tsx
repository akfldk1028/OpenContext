import React from 'react';
import {
  Card, CardBody, Flex, Icon, Text, Stat,
  StatNumber, StatHelpText, StatArrow, Badge, useColorModeValue
} from '@chakra-ui/react';
import { IconType } from 'react-icons';

interface StatCardProps {
  icon: IconType;
  title: string;
  value: string | number;
  helpText?: string;
  showArrow?: boolean;
  arrowType?: 'increase' | 'decrease';
  badge?: string;
  badgeColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  title,
  value,
  helpText,
  showArrow = false,
  arrowType = 'increase',
  badge,
  badgeColor = 'green'
}) => {
  const cardBg = useColorModeValue('customCard.light', 'customCard.dark');
  const accentColor = useColorModeValue('customAccent.light', 'customAccent.dark');
  const borderColor = useColorModeValue('customBorder.light', 'customBorder.dark');

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
            {showArrow && <StatArrow type={arrowType} color={accentColor} />}

          </StatHelpText>
        </Stat>
      </CardBody>
    </Card>
  );
};

export default StatCard;
