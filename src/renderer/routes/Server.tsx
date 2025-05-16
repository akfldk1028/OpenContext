import React, { useState } from 'react';
import { Box, Button, Input, VStack, Text } from '@chakra-ui/react';

export default function ServerPage() {
  const [serverUrl, setServerUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');

  const sendPrompt = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/agent/invoke/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          server_url: serverUrl,
          prompt: prompt
        })
      });

      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse('오류 발생: ' + err.message);
    }
  };

  return (
    <VStack spacing={4} align="stretch">
      <Box>
        <Text mb={2}>MCP 서버 주소</Text>
        <Input value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="예: http://localhost:5001/ask" />
      </Box>
      <Box>
        <Text mb={2}>프롬프트</Text>
        <Input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="예: 오늘 날씨 어때?" />
      </Box>
      <Button colorScheme="teal" onClick={sendPrompt}>MCP 서버로 보내기</Button>
      <Box mt={4}>
        <Text fontWeight="bold">응답:</Text>
        <pre>{response}</pre>
      </Box>
    </VStack>
  );
}
