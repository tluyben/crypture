'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Eye, EyeOff, Copy, Trash2, Settings, Download, Upload, GitFork, ChevronDown, Code, List, X, AlertTriangle, History, Clock, RotateCcw, Key, Shield } from 'lucide-react';
import Link from 'next/link';
import { Project, Environment, SecretConfig, Secret } from '@/lib/db/schema';

const SECRET_TYPES = [
  'text', 'email', 'password', 'uuid', 'date', 'datetime', 
  'integer', 'decimal', 'boolean', 'url', 'json', 'xml', 'yaml'
];

interface ProjectWithDetails extends Project {
  environments: (Environment & {
    secretConfigs: (SecretConfig & {
      secrets: Secret[];
    })[];
  })[];
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [activeConfig, setActiveConfig] = useState('');
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [isAddSecretOpen, setIsAddSecretOpen] = useState(false);
  const [newSecret, setNewSecret] = useState({
    key: '',
    value: '',
    type: 'text',
  });
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFormat, setImportFormat] = useState('env');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [isForkOpen, setIsForkOpen] = useState(false);
  const [forkConfigName, setForkConfigName] = useState('');
  const [forkConfigSuffix, setForkConfigSuffix] = useState('');
  const [forkTargetEnvironment, setForkTargetEnvironment] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'rows' | 'env'>('rows');
  const [envText, setEnvText] = useState('');
  const [isAddEnvironmentOpen, setIsAddEnvironmentOpen] = useState(false);
  const [newEnvironment, setNewEnvironment] = useState({ name: '', displayName: '', shortcut: '' });
  const [environmentToDelete, setEnvironmentToDelete] = useState<string | null>(null);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [isTokenManagementOpen, setIsTokenManagementOpen] = useState(false);
  const [tokens, setTokens] = useState<any[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [isCreateTokenOpen, setIsCreateTokenOpen] = useState(false);
  const [newToken, setNewToken] = useState({
    name: '',
    permissions: { environments: { '*': ['read'] } },
    expiresAt: '',
  });
  const [createdTokenValue, setCreatedTokenValue] = useState<string | null>(null);

  useEffect(() => {
    const initProject = async () => {
      const resolvedParams = await params;
      setProjectId(resolvedParams.id);
    };
    initProject();
  }, [params]);

  useEffect(() => {
    if (status === 'loading' || !projectId) return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    fetchProject();
  }, [projectId, session, status, router]);

  const fetchProject = async (preserveSelection = false) => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/details`);
      if (response.ok) {
        const data = await response.json();
        setProject(data);
        
        // Only set initial selection if not preserving and no current selection
        if (!preserveSelection && data.environments.length > 0 && !activeTab) {
          setActiveTab(data.environments[0].id);
          if (data.environments[0].secretConfigs.length > 0) {
            setActiveConfig(data.environments[0].secretConfigs[0].id);
          }
        }
      } else if (response.status === 404) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSecretVisibility = (secretId: string) => {
    const newVisible = new Set(visibleSecrets);
    if (newVisible.has(secretId)) {
      newVisible.delete(secretId);
    } else {
      newVisible.add(secretId);
    }
    setVisibleSecrets(newVisible);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    
    const currentTab = activeTab;
    const currentConfig = activeConfig;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/secrets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newSecret,
          secretConfigId: activeConfig,
        }),
      });

      if (response.ok) {
        setNewSecret({ key: '', value: '', type: 'text' });
        setIsAddSecretOpen(false);
        
        // Refresh project data while preserving current selection
        await fetchProject(true);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to add secret');
      }
    } catch (error) {
      console.error('Error adding secret:', error);
    }
  };

  const handleExport = async (format: string) => {
    if (!activeTab || !activeConfig || !projectId) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/export?format=${format}&environmentId=${activeTab}&secretConfigId=${activeConfig}`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `secrets.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting secrets:', error);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !activeTab || !activeConfig || !projectId) return;

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('environmentId', activeTab);
      formData.append('secretConfigId', activeConfig);
      formData.append('format', importFormat);
      formData.append('overwrite', overwriteExisting.toString());

      const response = await fetch(`/api/projects/${projectId}/import`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setImportFile(null);
        setIsImportOpen(false);
        fetchProject();
      }
    } catch (error) {
      console.error('Error importing secrets:', error);
    }
  };

  const handleFork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConfig || !forkConfigSuffix || !projectId) return;

    // Get current environment shortcut
    const currentEnv = project?.environments.find(env => env.id === activeTab);
    if (!currentEnv) return;

    const newConfigName = forkConfigSuffix ? `${currentEnv.shortcut}_${forkConfigSuffix}` : currentEnv.shortcut;

    try {
      const response = await fetch(`/api/projects/${projectId}/fork`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceConfigId: activeConfig,
          newConfigName,
          environmentId: activeTab, // Fork within same environment
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setForkConfigSuffix('');
        setIsForkOpen(false);
        
        // Refresh project data and then select the new config
        await fetchProject(true);
        
        // Set the active config to the newly created one
        if (result.newConfigId) {
          setActiveConfig(result.newConfigId);
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to fork configuration');
      }
    } catch (error) {
      console.error('Error forking config:', error);
    }
  };

  const convertSecretsToEnv = (secrets: Secret[]): string => {
    return secrets.map(secret => `${secret.key}=${secret.value}`).join('\n');
  };

  const parseEnvToSecrets = (envText: string): Array<{key: string, value: string}> => {
    return envText
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => {
        const [key, ...valueParts] = line.split('=');
        return {
          key: key.trim(),
          value: valueParts.join('=').trim().replace(/^["']|["']$/g, ''),
        };
      })
      .filter(item => item.key);
  };

  const switchToEnvMode = () => {
    const currentSecretConfig = project?.environments
      .find(env => env.id === activeTab)?.secretConfigs
      .find(config => config.id === activeConfig);
    
    if (currentSecretConfig?.secrets) {
      setEnvText(convertSecretsToEnv(currentSecretConfig.secrets));
    }
    setEditorMode('env');
  };

  const switchToRowsMode = () => {
    setEditorMode('rows');
  };

  const saveEnvText = async () => {
    if (!activeConfig || !projectId) return;

    const newSecrets = parseEnvToSecrets(envText);
    
    try {
      // Clear existing secrets
      await fetch(`/api/projects/${projectId}/secrets/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretConfigId: activeConfig }),
      });

      // Add new secrets
      for (const secret of newSecrets) {
        await fetch(`/api/projects/${projectId}/secrets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...secret,
            type: 'text',
            secretConfigId: activeConfig,
          }),
        });
      }

      fetchProject();
    } catch (error) {
      console.error('Error saving env text:', error);
    }
  };

  const handleAddEnvironment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/environments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEnvironment),
      });
      
      if (response.ok) {
        const result = await response.json();
        setNewEnvironment({ name: '', displayName: '', shortcut: '' });
        setIsAddEnvironmentOpen(false);
        
        // Refresh project data and then select the new environment
        await fetchProject(true);
        
        // Set the active tab to the newly created environment
        if (result.environmentId) {
          setActiveTab(result.environmentId);
          if (result.configId) {
            setActiveConfig(result.configId);
          }
        }
      }
    } catch (error) {
      console.error('Error adding environment:', error);
    }
  };

  const handleDeleteEnvironment = async (environmentId: string) => {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/environments/${environmentId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // If deleted environment was active, switch to first available
        if (activeTab === environmentId) {
          const remainingEnvs = project?.environments.filter(env => env.id !== environmentId) || [];
          if (remainingEnvs.length > 0) {
            setActiveTab(remainingEnvs[0].id);
            if (remainingEnvs[0].secretConfigs.length > 0) {
              setActiveConfig(remainingEnvs[0].secretConfigs[0].id);
            }
          }
        }
        setEnvironmentToDelete(null);
        fetchProject();
      }
    } catch (error) {
      console.error('Error deleting environment:', error);
    }
  };

  // Helper function to get all secret keys across all environments
  const getAllSecretKeys = (): string[] => {
    const allKeys = new Set<string>();
    project?.environments.forEach(env => {
      env.secretConfigs.forEach(config => {
        config.secrets.forEach(secret => {
          allKeys.add(secret.key);
        });
      });
    });
    return Array.from(allKeys).sort();
  };

  // Helper function to get missing keys for current config
  const getMissingKeys = (): string[] => {
    if (!currentSecretConfig) return [];
    
    const allKeys = getAllSecretKeys();
    const currentKeys = new Set(currentSecretConfig.secrets.map(s => s.key));
    
    return allKeys.filter(key => !currentKeys.has(key));
  };

  // Helper function to get environments that have a specific key
  const getEnvironmentsWithKey = (key: string): Environment[] => {
    if (!project) return [];
    
    return project.environments.filter(env => {
      return env.secretConfigs.some(config => {
        return config.secrets.some(secret => secret.key === key && secret.value.trim() !== '');
      });
    });
  };

  // Helper function to copy value from another environment
  const copyFromEnvironment = async (key: string, sourceEnvId: string) => {
    if (!project || !activeConfig || !projectId) return;
    
    const sourceEnv = project.environments.find(env => env.id === sourceEnvId);
    if (!sourceEnv) return;
    
    // Find the secret value in the source environment
    let secretValue = '';
    for (const config of sourceEnv.secretConfigs) {
      const secret = config.secrets.find(s => s.key === key);
      if (secret && secret.value.trim() !== '') {
        secretValue = secret.value;
        break;
      }
    }
    
    if (!secretValue) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value: secretValue,
          type: 'text',
          secretConfigId: activeConfig,
        }),
      });
      
      if (response.ok) {
        fetchProject(true);
      }
    } catch (error) {
      console.error('Error copying secret:', error);
    }
  };

  // Helper function to copy all missing fields from an environment
  const copyAllMissingFromEnvironment = async (sourceEnvId: string) => {
    if (!project || !activeConfig || !projectId) return;
    
    const sourceEnv = project.environments.find(env => env.id === sourceEnvId);
    if (!sourceEnv) return;
    
    const missingKeys = getMissingKeys();
    let copiedCount = 0;
    
    try {
      for (const key of missingKeys) {
        // Find the secret value in the source environment
        let secretValue = '';
        for (const config of sourceEnv.secretConfigs) {
          const secret = config.secrets.find(s => s.key === key);
          if (secret && secret.value.trim() !== '') {
            secretValue = secret.value;
            break;
          }
        }
        
        if (secretValue) {
          const response = await fetch(`/api/projects/${projectId}/secrets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key,
              value: secretValue,
              type: 'text',
              secretConfigId: activeConfig,
            }),
          });
          
          if (response.ok) {
            copiedCount++;
          }
        }
      }
      
      if (copiedCount > 0) {
        fetchProject(true);
        alert(`Successfully copied ${copiedCount} missing field(s) from ${sourceEnv.displayName}`);
      } else {
        alert(`No fields could be copied from ${sourceEnv.displayName}`);
      }
    } catch (error) {
      console.error('Error copying all missing fields:', error);
      alert('Error occurred while copying fields');
    }
  };

  // Helper function to get environments that have ANY of the missing keys
  const getEnvironmentsWithAnyMissingKey = (): Environment[] => {
    if (!project) return [];
    
    const missingKeys = getMissingKeys();
    return project.environments.filter(env => {
      return env.secretConfigs.some(config => {
        return config.secrets.some(secret => 
          missingKeys.includes(secret.key) && secret.value.trim() !== ''
        );
      });
    });
  };

  const fetchAuditLogs = async () => {
    if (!projectId) return;
    
    setLoadingAudit(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/audit`);
      if (response.ok) {
        const logs = await response.json();
        setAuditLogs(logs);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleRollback = async (auditLogId: string) => {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/secrets/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditLogId }),
      });
      
      if (response.ok) {
        fetchProject();
        fetchAuditLogs();
      }
    } catch (error) {
      console.error('Error during rollback:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'secret_created':
        return <Plus className="h-3 w-3 text-green-600" />;
      case 'secret_updated':
        return <Settings className="h-3 w-3 text-blue-600" />;
      case 'secret_deleted':
        return <Trash2 className="h-3 w-3 text-red-600" />;
      case 'secret_bulk_clear':
        return <X className="h-3 w-3 text-red-600" />;
      default:
        return <Clock className="h-3 w-3 text-gray-600" />;
    }
  };

  const canRollback = (action: string) => {
    return ['secret_created', 'secret_updated', 'secret_deleted'].includes(action);
  };

  const fetchTokens = async () => {
    if (!projectId) return;
    
    setLoadingTokens(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/tokens`);
      if (response.ok) {
        const tokensData = await response.json();
        setTokens(tokensData);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newToken),
      });
      
      if (response.ok) {
        const result = await response.json();
        setCreatedTokenValue(result.token);
        setNewToken({ name: '', permissions: { environments: { '*': ['read'] } }, expiresAt: '' });
        fetchTokens();
      }
    } catch (error) {
      console.error('Error creating token:', error);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/tokens/${tokenId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        fetchTokens();
      }
    } catch (error) {
      console.error('Error deleting token:', error);
    }
  };

  const handleToggleToken = async (tokenId: string, isActive: boolean) => {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/tokens/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      
      if (response.ok) {
        fetchTokens();
      }
    } catch (error) {
      console.error('Error updating token:', error);
    }
  };

  const formatTokenPermissions = (permissions: any) => {
    if (!permissions) return 'No permissions';
    if (permissions.admin) return 'Admin (Full Access)';
    
    const environments = permissions.environments || {};
    const envs = Object.keys(environments);
    const actions = Object.values(environments)
      .flat()
      .filter((v, i, arr) => arr.indexOf(v) === i);
    
    if (envs.length === 0) return 'No permissions';
    
    const envDisplay = envs.length === 1 && envs[0] === '*' ? 'All Envs' : envs.join(', ');
    return `${envDisplay}: ${actions.join(', ')}`;
  };

  const updateTokenPermission = (env: string, action: string, checked: boolean) => {
    setNewToken(prev => {
      const newPermissions = { ...prev.permissions };
      if (!newPermissions.environments[env]) {
        newPermissions.environments[env] = [];
      }
      
      if (checked) {
        if (!newPermissions.environments[env].includes(action)) {
          newPermissions.environments[env].push(action);
        }
      } else {
        newPermissions.environments[env] = newPermissions.environments[env].filter(a => a !== action);
      }
      
      return { ...prev, permissions: newPermissions };
    });
  };

  if (status === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!session) {
    return null;
  }

  if (!project) {
    return <div className="min-h-screen flex items-center justify-center">Project not found</div>;
  }

  const currentEnvironment = project.environments.find(env => env.id === activeTab);
  const currentSecretConfig = currentEnvironment?.secretConfigs.find(config => config.id === activeConfig);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {project.icon && <span className="text-2xl">{project.icon}</span>}
            <h1 className="text-3xl font-bold">{project.name}</h1>
          </div>
        </div>

        {project.description && (
          <p className="text-gray-600 mb-6">{project.description}</p>
        )}

        <Tabs value={activeTab} onValueChange={(envId) => {
          setActiveTab(envId);
          // Auto-select first secret config when switching environments
          const environment = project.environments.find(env => env.id === envId);
          if (environment && environment.secretConfigs.length > 0) {
            setActiveConfig(environment.secretConfigs[0].id);
          }
        }} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              {project.environments.map((env) => (
                <TabsTrigger key={env.id} value={env.id}>
                  {env.displayName}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex gap-2">
              <Dialog open={isAuditLogOpen} onOpenChange={(open) => {
                setIsAuditLogOpen(open);
                if (open) fetchAuditLogs();
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <History className="mr-2 h-4 w-4" />
                    Audit Log
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>Project Audit Log</DialogTitle>
                    <DialogDescription>
                      View and rollback secret changes for this project.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto max-h-[60vh]">
                    {loadingAudit ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <History className="h-8 w-8 mx-auto mb-2" />
                        <p>No audit logs yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="border rounded-lg p-3 hover:bg-gray-50">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="flex items-center gap-2 mt-1">
                                  {getActionIcon(log.action)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{log.details}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {log.action.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {log.userName || log.userEmail} • {formatTimestamp(log.timestamp)}
                                  </div>
                                  {log.metadata && (
                                    <div className="text-xs text-gray-600 mt-1">
                                      {log.metadata.environmentName && (
                                        <span className="mr-3">Env: {log.metadata.environmentName}</span>
                                      )}
                                      {log.metadata.configName && (
                                        <span>Config: {log.metadata.configName}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {canRollback(log.action) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRollback(log.id)}
                                  className="text-xs h-7"
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Rollback
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={isTokenManagementOpen} onOpenChange={(open) => {
                setIsTokenManagementOpen(open);
                if (open) fetchTokens();
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Key className="mr-2 h-4 w-4" />
                    API Tokens
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>API Token Management</DialogTitle>
                    <DialogDescription>
                      Create and manage API tokens for external access to this project's secrets.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Active Tokens</h3>
                      <Dialog open={isCreateTokenOpen} onOpenChange={setIsCreateTokenOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Token
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create API Token</DialogTitle>
                            <DialogDescription>
                              Generate a new API token with specific permissions.
                            </DialogDescription>
                          </DialogHeader>
                          {createdTokenValue ? (
                            <div className="space-y-4">
                              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <h4 className="font-medium text-green-800 mb-2">Token Created Successfully!</h4>
                                <p className="text-sm text-green-700 mb-3">
                                  Copy this token now - you won't be able to see it again.
                                </p>
                                <div className="flex items-center gap-2">
                                  <code className="flex-1 p-2 bg-white border rounded font-mono text-sm break-all">
                                    {createdTokenValue}
                                  </code>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(createdTokenValue)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <Button
                                onClick={() => {
                                  setCreatedTokenValue(null);
                                  setIsCreateTokenOpen(false);
                                }}
                                className="w-full"
                              >
                                Done
                              </Button>
                            </div>
                          ) : (
                            <form onSubmit={handleCreateToken} className="space-y-4">
                              <div>
                                <Label htmlFor="tokenName">Token Name</Label>
                                <Input
                                  id="tokenName"
                                  value={newToken.name}
                                  onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                                  placeholder="My API Token"
                                  required
                                />
                              </div>
                              
                              <div>
                                <Label>Permissions</Label>
                                <div className="space-y-2 mt-2">
                                  <div className="border rounded p-3">
                                    <div className="font-medium text-sm mb-2">All Environments</div>
                                    <div className="space-y-1">
                                      {['read', 'write'].map(action => (
                                        <div key={action} className="flex items-center space-x-2">
                                          <Checkbox
                                            id={`perm-*-${action}`}
                                            checked={newToken.permissions.environments['*']?.includes(action) || false}
                                            onCheckedChange={(checked) => updateTokenPermission('*', action, checked as boolean)}
                                          />
                                          <Label htmlFor={`perm-*-${action}`} className="text-sm capitalize">
                                            {action}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <Label htmlFor="expiresAt">Expires At (Optional)</Label>
                                <Input
                                  id="expiresAt"
                                  type="datetime-local"
                                  value={newToken.expiresAt}
                                  onChange={(e) => setNewToken({ ...newToken, expiresAt: e.target.value })}
                                />
                              </div>
                              
                              <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" onClick={() => setIsCreateTokenOpen(false)}>
                                  Cancel
                                </Button>
                                <Button type="submit">Create Token</Button>
                              </div>
                            </form>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    <div className="overflow-y-auto max-h-[50vh]">
                      {loadingTokens ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : tokens.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Key className="h-8 w-8 mx-auto mb-2" />
                          <p>No API tokens yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tokens.map((token) => (
                            <div key={token.id} className="border rounded-lg p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{token.name}</span>
                                    <Badge variant={token.isActive ? 'default' : 'secondary'}>
                                      {token.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                    {token.expiresAt && (
                                      <Badge variant="outline" className="text-xs">
                                        Expires {new Date(token.expiresAt).toLocaleDateString()}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {formatTokenPermissions(token.permissions ? JSON.parse(token.permissions) : null)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Created: {new Date(token.createdAt).toLocaleDateString()}
                                    {token.lastUsed && (
                                      <span className="ml-3">
                                        Last used: {new Date(token.lastUsed).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleToggleToken(token.id, !token.isActive)}
                                    className="text-xs"
                                  >
                                    {token.isActive ? 'Disable' : 'Enable'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteToken(token.id)}
                                    className="text-xs text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2">API Usage Examples</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <code className="block p-2 bg-gray-100 rounded text-xs">
                            curl -H "Authorization: Bearer YOUR_TOKEN" \
                            https://your-domain.com/api/v1/secrets?environment=production
                          </code>
                        </div>
                        <div>
                          <code className="block p-2 bg-gray-100 rounded text-xs">
                            {`curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \\
-H "Content-Type: application/json" \\
-d '{"environment":"development","secrets":{"KEY":"value"}}' \\
https://your-domain.com/api/v1/secrets`}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={isAddEnvironmentOpen} onOpenChange={setIsAddEnvironmentOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Environment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Environment</DialogTitle>
                    <DialogDescription>
                      Create a new environment for your project.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddEnvironment} className="space-y-4">
                    <div>
                      <Label htmlFor="envDisplayName">Environment Name</Label>
                      <Input
                        id="envDisplayName"
                        value={newEnvironment.displayName}
                        onChange={(e) => {
                          const displayName = e.target.value;
                          // Auto-generate shortcut from display name
                          const shortcut = displayName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 3);
                          setNewEnvironment({ 
                            ...newEnvironment, 
                            displayName,
                            name: displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                            shortcut 
                          });
                        }}
                        placeholder="Production"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="envShortcut">Shortcut (3 chars max)</Label>
                      <Input
                        id="envShortcut"
                        value={newEnvironment.shortcut}
                        onChange={(e) => setNewEnvironment({ ...newEnvironment, shortcut: e.target.value.toLowerCase() })}
                        placeholder="prd"
                        pattern="^[a-z]{1,3}$"
                        title="Must be 1-3 lowercase letters"
                        maxLength={3}
                        required
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        This shortcut will prefix all secret configurations (e.g., prd_default, prd_local)
                      </p>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsAddEnvironmentOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Add Environment</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              
              {project.environments.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {project.environments.map((env) => (
                      <DropdownMenuItem
                        key={env.id}
                        onClick={() => setEnvironmentToDelete(env.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {env.displayName}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          {/* Environment deletion confirmation */}
          <Dialog open={!!environmentToDelete} onOpenChange={() => setEnvironmentToDelete(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Environment</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this environment? This action cannot be undone and will delete all associated secret configurations and secrets.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 p-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">This will permanently delete all secrets in this environment.</span>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEnvironmentToDelete(null)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => environmentToDelete && handleDeleteEnvironment(environmentToDelete)}
                >
                  Delete Environment
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {project.environments.map((environment) => (
            <TabsContent key={environment.id} value={environment.id} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">{environment.displayName}</h2>
                <div className="flex gap-2">
                  <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Upload className="mr-2 h-4 w-4" />
                        Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import Secrets</DialogTitle>
                        <DialogDescription>
                          Import secrets from a file into the current configuration.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleImport} className="space-y-4">
                        <div>
                          <Label htmlFor="file">Select File</Label>
                          <Input
                            id="file"
                            type="file"
                            accept=".env,.json,.yaml,.yml,.csv"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="format">File Format</Label>
                          <Select value={importFormat} onValueChange={setImportFormat}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="env">.env</SelectItem>
                              <SelectItem value="json">JSON</SelectItem>
                              <SelectItem value="yaml">YAML</SelectItem>
                              <SelectItem value="csv">CSV</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="overwrite"
                            checked={overwriteExisting}
                            onCheckedChange={(checked) => setOverwriteExisting(checked as boolean)}
                          />
                          <Label htmlFor="overwrite">Overwrite existing secrets</Label>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsImportOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">Import</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleExport('env')}>
                        Export as .env
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('json')}>
                        Export as JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('yaml')}>
                        Export as YAML
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('csv')}>
                        Export as CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-64 space-y-2">
                  <h3 className="font-medium">Secret Configs</h3>
                  {environment.secretConfigs.map((config) => (
                    <Card
                      key={config.id}
                      className={`cursor-pointer transition-colors ${
                        activeConfig === config.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setActiveConfig(config.id)}
                    >
                      <CardContent className="px-3 py-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{config.name}</span>
                          <Badge variant="secondary" className="text-xs h-4 px-1.5">
                            {config.secrets?.length || 0}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Dialog open={isForkOpen} onOpenChange={setIsForkOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={!activeConfig}
                      >
                        <GitFork className="mr-2 h-4 w-4" />
                        Fork Config
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Fork Secret Configuration</DialogTitle>
                        <DialogDescription>
                          Create a copy of the current configuration within this environment.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleFork} className="space-y-4">
                        <div>
                          <Label htmlFor="configSuffix">Configuration Suffix</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded border">
                              {project?.environments.find(env => env.id === activeTab)?.shortcut}_
                            </span>
                            <Input
                              id="configSuffix"
                              value={forkConfigSuffix}
                              onChange={(e) => setForkConfigSuffix(e.target.value)}
                              placeholder="local"
                              pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"
                              title="Must be a valid identifier (letters, numbers, underscores, cannot start with number)"
                              className="flex-1"
                              required
                            />
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Enter the suffix for your new configuration (e.g., "local" creates "{project?.environments.find(env => env.id === activeTab)?.shortcut}_local")
                          </p>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsForkOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">Fork Configuration</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="flex-1">
                  {currentSecretConfig && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>{currentSecretConfig.name}</CardTitle>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center border rounded-lg">
                              <Button
                                variant={editorMode === 'rows' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={switchToRowsMode}
                                className="rounded-r-none border-r"
                              >
                                <List className="h-4 w-4" />
                              </Button>
                              <Button
                                variant={editorMode === 'env' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={switchToEnvMode}
                                className="rounded-l-none"
                              >
                                <Code className="h-4 w-4" />
                              </Button>
                            </div>
                            {editorMode === 'rows' && (
                              <Dialog open={isAddSecretOpen} onOpenChange={setIsAddSecretOpen}>
                                <DialogTrigger asChild>
                                  <Button size="sm">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Secret
                                  </Button>
                                </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Add New Secret</DialogTitle>
                                <DialogDescription>
                                  Add a new secret to {currentSecretConfig.name}
                                </DialogDescription>
                              </DialogHeader>
                              <form onSubmit={handleAddSecret} className="space-y-4">
                                <div>
                                  <Label htmlFor="key">Key</Label>
                                  <Input
                                    id="key"
                                    value={newSecret.key}
                                    onChange={(e) => setNewSecret({ ...newSecret, key: e.target.value })}
                                    placeholder="DATABASE_URL"
                                    required
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="value">Value</Label>
                                  <Input
                                    id="value"
                                    type={newSecret.type === 'password' ? 'password' : 'text'}
                                    value={newSecret.value}
                                    onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })}
                                    placeholder="Enter value..."
                                    required
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="type">Type</Label>
                                  <Select
                                    value={newSecret.type}
                                    onValueChange={(value) => setNewSecret({ ...newSecret, type: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SECRET_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>
                                          {type}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex justify-end space-x-2">
                                  <Button type="button" variant="outline" onClick={() => setIsAddSecretOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button type="submit">Add Secret</Button>
                                </div>
                              </form>
                            </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {editorMode === 'env' ? (
                          <div className="space-y-4">
                            <Textarea
                              value={envText}
                              onChange={(e) => setEnvText(e.target.value)}
                              placeholder="KEY1=value1&#10;KEY2=value2&#10;# Comments are supported"
                              className="min-h-[300px] font-mono text-sm"
                            />
                            <div className="flex justify-end">
                              <Button onClick={saveEnvText}>
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              {/* Existing secrets */}
                              {currentSecretConfig.secrets && currentSecretConfig.secrets.length > 0 ? (
                                currentSecretConfig.secrets.map((secret) => (
                                  <div
                                    key={secret.id}
                                    className="flex items-center gap-3 p-2 border rounded-lg"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 w-40 flex-shrink-0">
                                      <span className="text-sm font-medium truncate">{secret.key}</span>
                                      <Badge variant="outline" className="text-xs h-4 px-1.5 flex-shrink-0">
                                        {secret.type}
                                      </Badge>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <code className="block w-full text-sm bg-gray-100 px-2 py-1 rounded font-mono truncate">
                                        {visibleSecrets.has(secret.id) 
                                          ? secret.value 
                                          : '•'.repeat(Math.min(secret.value.length, 20))
                                        }
                                      </code>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => toggleSecretVisibility(secret.id)}
                                        className="h-7 w-7 p-0"
                                      >
                                        {visibleSecrets.has(secret.id) ? (
                                          <EyeOff className="h-3 w-3" />
                                        ) : (
                                          <Eye className="h-3 w-3" />
                                        )}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyToClipboard(secret.value)}
                                        className="h-7 w-7 p-0"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {}}
                                        className="h-7 w-7 p-0"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-8 text-gray-500">
                                  <Settings className="h-8 w-8 mx-auto mb-2" />
                                  <p>No secrets yet. Add your first secret to get started.</p>
                                </div>
                              )}
                              
                              {/* Missing fields section - always show if there are missing keys */}
                              {getMissingKeys().length > 0 && (
                                <div className="space-y-2 mt-4 pt-4 border-t">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                                      <AlertTriangle className="h-4 w-4" />
                                      Missing Fields ({getMissingKeys().length})
                                    </div>
                                    {getEnvironmentsWithAnyMissingKey().length > 0 && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                          >
                                            <Copy className="h-3 w-3 mr-1" />
                                            Copy all from
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                          {getEnvironmentsWithAnyMissingKey().map((env) => (
                                            <DropdownMenuItem
                                              key={env.id}
                                              onClick={() => copyAllMissingFromEnvironment(env.id)}
                                            >
                                              <span className="font-medium">{env.displayName}</span>
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                  {getMissingKeys().map((key) => {
                                    const envsWithKey = getEnvironmentsWithKey(key);
                                    return (
                                      <div
                                        key={key}
                                        className="flex items-center gap-3 p-2 border border-red-200 bg-red-50 rounded-lg"
                                      >
                                        <div className="flex items-center gap-2 min-w-0 w-40 flex-shrink-0">
                                          <span className="text-sm font-medium truncate text-red-700">{key}</span>
                                          <Badge variant="destructive" className="text-xs h-4 px-1.5 flex-shrink-0">
                                            missing
                                          </Badge>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <code className="block w-full text-sm bg-red-100 px-2 py-1 rounded font-mono text-red-600">
                                            (empty)
                                          </code>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          {envsWithKey.length > 0 && (
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-7 px-2 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                                >
                                                  <Copy className="h-3 w-3 mr-1" />
                                                  Copy from
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent>
                                                {envsWithKey.map((env) => (
                                                  <DropdownMenuItem
                                                    key={env.id}
                                                    onClick={() => copyFromEnvironment(key, env.id)}
                                                  >
                                                    <span className="font-medium">{env.displayName}</span>
                                                  </DropdownMenuItem>
                                                ))}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}