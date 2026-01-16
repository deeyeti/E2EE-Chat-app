import React, { useState, useEffect, useRef } from 'react';
import { 
  generateECDHKeyPair, 
  exportPublicKey, 
  importPublicKey, 
  deriveSharedSecret,
  encryptMessage,
  decryptMessage 
} from './services/crypto';
import { KeyExchange } from './components/KeyExchange';
import { ChatInterface } from './components/ChatInterface';
import { Message, EncryptedPacket } from './types';
import { Loader2 } from 'lucide-react';

const BROADCAST_CHANNEL_NAME = 'pastel-secure-chat-demo';

function App() {
  // Key State
  const [myKeys, setMyKeys] = useState<CryptoKeyPair | null>(null);
  const [myPublicKeyStr, setMyPublicKeyStr] = useState<string>('');
  const [sharedSecret, setSharedSecret] = useState<CryptoKey | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'init' | 'connecting' | 'connected'>('init');

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Communication Channel
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Initialize Keys on Mount
  useEffect(() => {
    const initKeys = async () => {
      try {
        const keys = await generateECDHKeyPair();
        const pubStr = await exportPublicKey(keys.publicKey);
        setMyKeys(keys);
        setMyPublicKeyStr(pubStr);
      } catch (error) {
        console.error("Failed to generate keys", error);
      }
    };
    initKeys();

    // Setup Broadcast Channel for local tab-to-tab communication
    const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channelRef.current = bc;

    return () => {
      bc.close();
    };
  }, []);

  // Handle Incoming Messages
  useEffect(() => {
    if (!channelRef.current || !sharedSecret) return;

    const handleMessage = async (event: MessageEvent) => {
      const packet = event.data as EncryptedPacket;
      try {
        const decryptedText = await decryptMessage(sharedSecret, packet.ciphertext, packet.iv);
        const newMessage: Message = {
          id: Math.random().toString(36).substring(7),
          content: decryptedText,
          sender: 'peer',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, newMessage]);
      } catch (error) {
        console.error("Failed to decrypt message - likely from a different session or invalid key", error);
      }
    };

    channelRef.current.onmessage = handleMessage;
    
    return () => {
      if (channelRef.current) channelRef.current.onmessage = null;
    };
  }, [sharedSecret]);

  const handleConnectPeer = async (peerKeyStr: string) => {
    if (!myKeys) return;
    setConnectionStatus('connecting');
    
    // Artificial delay for UX
    await new Promise(r => setTimeout(r, 800));

    try {
      const peerKey = await importPublicKey(peerKeyStr);
      const secret = await deriveSharedSecret(myKeys.privateKey, peerKey);
      setSharedSecret(secret);
      setConnectionStatus('connected');
    } catch (error) {
      console.error("Connection failed", error);
      setConnectionStatus('init');
      throw error; 
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!sharedSecret || !channelRef.current) return;

    try {
      const { ciphertext, iv } = await encryptMessage(sharedSecret, text);
      
      // Broadcast encrypted packet
      const packet: EncryptedPacket = { ciphertext, iv };
      channelRef.current.postMessage(packet);

      // Add to local UI
      const newMessage: Message = {
        id: Math.random().toString(36).substring(7),
        content: text,
        sender: 'me',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, newMessage]);
    } catch (error) {
      console.error("Encryption failed", error);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!myKeys) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-pastel-bg text-slate-800">
        <div className="border-4 border-black p-8 bg-white shadow-hard text-center">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-pastel-primary mx-auto" />
          <p className="font-pixel text-xs tracking-wide">GENERATING ID...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-pastel-bg relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      <div className="w-full h-full md:max-w-5xl md:h-[90vh] flex flex-col relative z-10 md:border-4 md:border-black md:shadow-hard-lg bg-white overflow-hidden">
        
        {/* Connection Status Indicator */}
        {connectionStatus !== 'connected' && (
             <div className="absolute top-4 left-0 w-full flex justify-center py-4 pointer-events-none z-50">
                 <div className="bg-white px-4 py-2 border-2 border-black shadow-hard-sm text-[10px] font-pixel text-slate-600">
                     E2E ENCRYPTED :: MODE_SECURE
                 </div>
             </div>
        )}

        {connectionStatus === 'connected' ? (
          <ChatInterface 
            messages={messages} 
            onSendMessage={handleSendMessage}
            onClearChat={clearChat}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50">
            <KeyExchange 
              myPublicKey={myPublicKeyStr} 
              onConnect={handleConnectPeer}
              isConnecting={connectionStatus === 'connecting'}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;