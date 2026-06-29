'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { db } from '@/lib/fazai-db';
import {
  AI_PROVIDERS,
  type AiProviderId,
  type AiProviderConfig,
  testConnection,
} from '@/lib/ai-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot, Eye, EyeOff, Check, X, Loader2, Zap, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

/** Providers visible to users in the admin settings dropdown. Groq is hidden (internal-only).
 *  Sorted A-Z by provider name for consistent ordering. */
const PROVIDER_IDS: AiProviderId[] = [
  'anthropic', 'deepseek', 'google', 'kimi', 'openai', 'qwen', 'zai',
];

export function AdminAiSettings() {
  const { lang } = useAuthStore();
  const { toast } = useToast();

  const [provider, setProvider] = useState<AiProviderId>('openai');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved settings from Dexie
  useEffect(() => {
    (async () => {
      try {
        const provSetting = await db.settings.get('ai-provider');
        const modelSetting = await db.settings.get('ai-model');
        const keySetting = await db.settings.get('ai-api-key');
        const endpointSetting = await db.settings.get('ai-endpoint');

        if (provSetting?.value) {
          const savedProvider = provSetting.value as AiProviderId;
          // Silently remap hidden providers (e.g. groq) to a visible default
          if (!PROVIDER_IDS.includes(savedProvider)) {
            setProvider('openai');
          } else {
            setProvider(savedProvider);
          }
        }
        if (modelSetting?.value) setModel(modelSetting.value);
        if (keySetting?.value) setApiKey(keySetting.value);
        if (endpointSetting?.value) setEndpoint(endpointSetting.value);
      } catch (e) {
        console.error('Failed to load AI settings:', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Update model & endpoint when provider changes (only if not loaded yet or user hasn't customized)
  const handleProviderChange = useCallback((newProvider: string) => {
    const pid = newProvider as AiProviderId;
    setProvider(pid);
    const info = AI_PROVIDERS[pid];
    setModel(info.defaultModel);
    setEndpoint('');
    setTestResult(null);
  }, []);

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);

    const config: AiProviderConfig = {
      provider,
      model: model || AI_PROVIDERS[provider].defaultModel,
      apiKey: apiKey.trim(),
      endpoint: endpoint.trim() || undefined,
    };

    try {
      const result = await testConnection(config);
      if (result.toLowerCase().includes('ok')) {
        setTestResult('success');
        toast({
          title: lang === 'id' ? 'Koneksi berhasil!' : lang === 'zh' ? '连接成功！' : 'Connection successful!',
          description: lang === 'id'
            ? 'API key dan konfigurasi berfungsi.'
            : lang === 'zh'
            ? 'API密钥和配置有效。'
            : 'API key and configuration are valid.',
        });
      } else {
        setTestResult('success'); // got any response = connection works
        toast({
          title: lang === 'id' ? 'Koneksi berhasil' : lang === 'zh' ? '连接成功' : 'Connected',
          description: `Response: ${result.substring(0, 50)}`,
        });
      }
    } catch (err: any) {
      setTestResult('fail');
      toast({
        title: lang === 'id' ? 'Koneksi gagal' : lang === 'zh' ? '连接失败' : 'Connection failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await db.settings.put({ key: 'ai-provider', value: provider });
      await db.settings.put({ key: 'ai-model', value: model || AI_PROVIDERS[provider].defaultModel });
      await db.settings.put({ key: 'ai-api-key', value: apiKey.trim() });
      await db.settings.put({ key: 'ai-endpoint', value: endpoint.trim() });
      // User override: sync to OCR config as well
      await db.settings.put({ key: 'ocr-provider', value: provider });
      await db.settings.put({ key: 'ocr-model', value: model || AI_PROVIDERS[provider].defaultModel });
      await db.settings.put({ key: 'ocr-api-key', value: apiKey.trim() });
      await db.settings.put({ key: 'ocr-endpoint', value: endpoint.trim() });

      toast({
        title: lang === 'id' ? 'Tersimpan!' : lang === 'zh' ? '已保存！' : 'Saved!',
        description: lang === 'id'
          ? 'Pengaturan AI berhasil disimpan.'
          : lang === 'zh'
          ? 'AI设置已保存。'
          : 'AI settings saved successfully.',
      });
    } catch (e) {
      console.error('Failed to save AI settings:', e);
      toast({
        title: lang === 'id' ? 'Gagal menyimpan' : lang === 'zh' ? '保存失败' : 'Save failed',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const providerInfo = AI_PROVIDERS[provider];

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
          <Bot className="w-4 h-4 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">
            {lang === 'id' ? 'Pengaturan AI' : lang === 'zh' ? 'AI设置' : 'AI Configuration'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {lang === 'id'
              ? 'Konfigurasi provider AI dan API key untuk asisten keuangan'
              : lang === 'zh'
              ? '配置AI提供商和API密钥'
              : 'Configure AI provider and API key for the financial assistant'}
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        {/* Provider Dropdown */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {lang === 'id' ? 'Provider AI' : lang === 'zh' ? 'AI提供商' : 'AI Provider'}
          </label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_IDS.map(pid => (
                <SelectItem key={pid} value={pid}>
                  {AI_PROVIDERS[pid].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {lang === 'id' ? 'Model' : lang === 'zh' ? '模型' : 'Model'}
          </label>
          <Select value={model || providerInfo.defaultModel} onValueChange={setModel}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerInfo.models.map(m => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            {lang === 'id'
              ? 'Model default: ' + providerInfo.defaultModel
              : lang === 'zh'
              ? '默认模型：' + providerInfo.defaultModel
              : 'Default model: ' + providerInfo.defaultModel}
          </p>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            API Key
          </label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
              placeholder={lang === 'id' ? 'Masukkan API key...' : lang === 'zh' ? '输入API密钥...' : 'Enter API key...'}
              className="h-9 text-sm pr-9"
            />
            <button
              type="button"
              onClick={() => setShowKey(prev => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {lang === 'id'
              ? 'Kunci disimpan secara lokal di perangkat Anda'
              : lang === 'zh'
              ? '密钥保存在您的设备本地'
              : 'Key is stored locally on your device'}
          </p>
        </div>

        {/* Custom Endpoint (Advanced) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Settings2 className="w-3 h-3" />
            {lang === 'id' ? 'Endpoint Kustom' : lang === 'zh' ? '自定义端点' : 'Custom Endpoint'}{' '}
            <span className="text-[10px] text-muted-foreground">
              ({lang === 'id' ? 'opsional' : lang === 'zh' ? '可选' : 'optional'})
            </span>
          </label>
          <Input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder={providerInfo.defaultEndpoint}
            className="h-9 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            {lang === 'id'
              ? 'Default: ' + providerInfo.defaultEndpoint
              : lang === 'zh'
              ? '默认：' + providerInfo.defaultEndpoint
              : 'Default: ' + providerInfo.defaultEndpoint}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs flex-1"
            onClick={handleTest}
            disabled={testing || !apiKey.trim()}
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : testResult === 'success' ? (
              <Check className="w-3.5 h-3.5 mr-1 text-green-600" />
            ) : testResult === 'fail' ? (
              <X className="w-3.5 h-3.5 mr-1 text-red-600" />
            ) : null}
            {lang === 'id'
              ? 'Tes Koneksi'
              : lang === 'zh'
              ? '测试连接'
              : 'Test Connection'}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs flex-1 bg-red-600 hover:bg-red-700"
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : null}
            {lang === 'id' ? 'Simpan' : lang === 'zh' ? '保存' : 'Save'}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
