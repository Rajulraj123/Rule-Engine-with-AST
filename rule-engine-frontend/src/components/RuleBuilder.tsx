import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ReactFlow, { 
  Controls, 
  Background,
  Node,
  Edge 
} from 'reactflow';
import 'reactflow/dist/style.css';

interface Rule {
  rule_id?: number;
  name: string;
  description: string;
  rule_string: string;
  ast: any;
}

interface CombineRuleData {
  rules: number[];
  operator: 'AND' | 'OR';
  name: string;
  description: string;
}

const BACKEND_URL = 'http://localhost:8000';

const RuleEngine = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [newRule, setNewRule] = useState<Rule>({
    name: '',
    description: '',
    rule_string: '',
    ast: null
  });
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [evaluationData, setEvaluationData] = useState('');
  const [evaluationResults, setEvaluationResults] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showCombineDialog, setShowCombineDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [selectedRules, setSelectedRules] = useState<number[]>([]);
  const [combineRuleData, setCombineRuleData] = useState<CombineRuleData>({
    rules: [],
    operator: 'AND',
    name: '',
    description: ''
  });
  const [batchData, setBatchData] = useState<string>('');
  const [batchResults, setBatchResults] = useState<any[]>([]);

  const validateJsonData = (jsonString: string): boolean => {
    try {
      if (!jsonString.trim()) {
        throw new Error('Evaluation data cannot be empty');
      }
      const parsed = JSON.parse(jsonString);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Data must be a JSON object or array');
      }
      return true;
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format. Please check your input.');
      } else {
        setError(err instanceof Error ? err.message : 'Invalid data format');
      }
      return false;
    }
  };

  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        setConnectionStatus('connected');
        return true;
      }
      throw new Error('Backend not responding');
    } catch (err) {
      setConnectionStatus('disconnected');
      setError('Cannot connect to backend server. Please ensure it is running at ' + BACKEND_URL);
      return false;
    }
  };
  const fetchRules = async () => {
    try {
      setIsLoading(true);
      const isConnected = await checkBackendConnection();
      if (!isConnected) return;

      const response = await fetch(`${BACKEND_URL}/rules/`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setRules(data);
      setError('');
    } catch (err) {
      setError('Failed to fetch rules: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const validateRule = (rule: Rule) => {
    if (!rule.name.trim()) {
      throw new Error('Rule name is required');
    }
    if (!rule.rule_string.trim()) {
      throw new Error('Rule expression is required');
    }
    if (!rule.rule_string.includes('AND') && !rule.rule_string.includes('OR')) {
      throw new Error('Rule must contain at least one operator (AND/OR)');
    }
  };

  const createRule = async () => {
    try {
      setIsSubmitting(true);
      setError('');
      
      const isConnected = await checkBackendConnection();
      if (!isConnected) return;

      validateRule(newRule);

      const response = await fetch(`${BACKEND_URL}/rules/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newRule.name.trim(),
          description: newRule.description.trim(),
          rule_string: newRule.rule_string.trim()
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create rule');
      }
      
      await fetchRules();
      setNewRule({ name: '', description: '', rule_string: '', ast: null });
      setShowDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteRule = async (ruleId: number) => {
    try {
      const response = await fetch(`${BACKEND_URL}/rules/${ruleId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete rule');
      }
      
      await fetchRules();
      setSelectedRules(selectedRules.filter(id => id !== ruleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const combineRules = async () => {
    try {
      setError('');
      const response = await fetch(`${BACKEND_URL}/rules/combine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...combineRuleData,
          rules: selectedRules
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to combine rules');
      }
      
      await fetchRules();
      setShowCombineDialog(false);
      setSelectedRules([]);
      setCombineRuleData({
        rules: [],
        operator: 'AND',
        name: '',
        description: ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to combine rules');
    }
  };

  const evaluateRule = async (ruleId: number) => {
    try {
      setError('');
      
      const isConnected = await checkBackendConnection();
      if (!isConnected) return;

      if (!validateJsonData(evaluationData)) {
        return;
      }

      const parsedData = JSON.parse(evaluationData);
      
      const response = await fetch(`${BACKEND_URL}/rules/evaluate/${ruleId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: parsedData }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to evaluate rule');
      }

      const result = await response.json();
      setEvaluationResults({ ...evaluationResults, [ruleId]: result.result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate rule');
    }
  };

  const evaluateBatch = async () => {
    try {
      if (!validateJsonData(batchData)) {
        return;
      }
      
      const dataList = JSON.parse(batchData);
      if (!Array.isArray(dataList)) {
        throw new Error('Batch data must be an array of objects');
      }
      
      const response = await fetch(`${BACKEND_URL}/rules/evaluate-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rule_ids: rules.map(r => r.rule_id),
          data_list: dataList
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to evaluate batch');
      }
      
      const result = await response.json();
      setBatchResults(result.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate batch');
    }
  };

  const formatJsonInput = () => {
    try {
      const parsed = JSON.parse(evaluationData);
      setEvaluationData(JSON.stringify(parsed, null, 2));
      setError('');
    } catch (err) {
      setError('Invalid JSON format. Unable to format.');
    }
  };

  const ASTVisualizer = ({ ast }: { ast: any }) => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    
    useEffect(() => {
      const buildGraph = (node: any, parentId?: string, position = { x: 0, y: 0 }) => {
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];
        
        const nodeId = parentId ? `${parentId}-${node.type}` : 'root';
        
        newNodes.push({
          id: nodeId,
          position,
          data: { label: node.value || node.type },
          type: 'default',
        });
        
        if (node.left) {
          const leftPos = { x: position.x - 100, y: position.y + 100 };
          const leftResults = buildGraph(node.left, `${nodeId}-left`, leftPos);
          newNodes.push(...leftResults.nodes);
          newEdges.push(...leftResults.edges);
          newEdges.push({
            id: `${nodeId}-left`,
            source: nodeId,
            target: `${nodeId}-left-${node.left.type}`,
          });
        }
        
        if (node.right) {
          const rightPos = { x: position.x + 100, y: position.y + 100 };
          const rightResults = buildGraph(node.right, `${nodeId}-right`, rightPos);
          newNodes.push(...rightResults.nodes);
          newEdges.push(...rightResults.edges);
          newEdges.push({
            id: `${nodeId}-right`,
            source: nodeId,
            target: `${nodeId}-right-${node.right.type}`,
          });
        }
        
        return { nodes: newNodes, edges: newEdges };
      };
      
      const graph = buildGraph(ast);
      setNodes(graph.nodes);
      setEdges(graph.edges);
    }, [ast]);
    
    return (
      <div className="h-[400px] border rounded-lg">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    );
  };

  const renderConnectionStatus = () => (
    <div className="flex items-center space-x-2 mb-4">
      <div 
        className={`w-2 h-2 rounded-full ${
          connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className="text-sm text-gray-600">
        {connectionStatus === 'connected' ? 'Connected to backend' : 'Backend disconnected'}
      </span>
      <Button 
        variant="outline" 
        size="sm"
        onClick={fetchRules}
        className="ml-2"
      >
        <RefreshCw className="h-4 w-4 mr-1" />
        Retry
      </Button>
    </div>
  );

  const renderRulesList = () => {
    if (isLoading) {
      return (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Loading rules...</p>
        </div>
      );
    }

    if (rules.length === 0) {
      return (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <p>No rules created yet. Click "Create New Rule" to get started.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {rules.map((rule) => (
          <Card key={rule.rule_id} className="bg-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedRules.includes(rule.rule_id!)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRules([...selectedRules, rule.rule_id!]);
                        } else {
                          setSelectedRules(selectedRules.filter(id => id !== rule.rule_id));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <h3 className="text-lg font-semibold">{rule.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{rule.description}</p>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <code className="text-sm font-mono text-gray-800">
                      {rule.rule_string}
                    </code>
                  </div>
                </div>
                <div className="flex items-start space-x-2 ml-4">
                  <Button 
                    variant="outline"
                    onClick={() => rule.rule_id && evaluateRule(rule.rule_id)}
                  >
                    Evaluate
                  </Button>
                  <Button 
                    variant="destructive"
                    size="icon"
                    onClick={() => rule.rule_id && deleteRule(rule.rule_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {evaluationResults[rule.rule_id!] !== undefined && (
                    <div className="flex items-center p-2 rounded-full bg-gray-50">
                      {evaluationResults[rule.rule_id!] ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderCreateRuleDialog = () => (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button className="mb-4" disabled={connectionStatus === 'disconnected'}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Rule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Rule</DialogTitle>
          <DialogDescription>
            Enter the details for your new rule. Use AND/OR operators and parentheses.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Rule Name</h4>
            <Input
              placeholder="Enter rule name"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Description</h4>
            <Textarea
              placeholder="Enter rule description"
              value={newRule.description}
              onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Rule Expression</h4>
            <Textarea
              placeholder="(age > 30 AND department = 'Sales')"
              value={newRule.rule_string}
              onChange={(e) => setNewRule({ ...newRule, rule_string: e.target.value })}
              className="font-mono"
            />
            <p className="text-sm text-gray-500">
              Example: (age > 30 AND department = 'Sales') OR (experience >= 5)
            </p>
          </div>
          
          <div className="pt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={createRule} 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderCombineRulesDialog = () => (
    <Dialog open={showCombineDialog} onOpenChange={setShowCombineDialog}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Combine Rules</DialogTitle>
          <DialogDescription>
            Combine selected rules with an operator.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">New Rule Name</h4>
            <Input
              placeholder="Enter combined rule name"
              value={combineRuleData.name}
              onChange={(e) => setCombineRuleData({ ...combineRuleData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Description</h4>
            <Textarea
              placeholder="Enter combined rule description"
              value={combineRuleData.description}
              onChange={(e) => setCombineRuleData({ ...combineRuleData, description: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Operator</h4>
            <select
              className="w-full p-2 border rounded-md"
              value={combineRuleData.operator}
              onChange={(e) => setCombineRuleData({ 
                ...combineRuleData, 
                operator: e.target.value as 'AND' | 'OR'
              })}
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          </div>
          
          <div className="pt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowCombineDialog(false)}>
              Cancel
            </Button>
            <Button onClick={combineRules}>
              Combine Rules
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderEvaluationSection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Evaluation Data</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={formatJsonInput}
            disabled={!evaluationData.trim()}
          >
            Format JSON
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            placeholder='{"age": 35, "department": "Sales", "salary": 60000}'
            value={evaluationData}
            onChange={(e) => setEvaluationData(e.target.value)}
            className="font-mono min-h-[200px]"
          />
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="font-medium mb-2">Example Format:</h4>
            <code className="text-sm block whitespace-pre">
{`{
  "age": 35,
  "department": "Sales",
  "salary": 60000,
  "experience": 5,
  "role": "Manager"
}`}
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderBatchEvaluationSection = () => (
    <Card>
      <CardHeader>
        <CardTitle>Batch Evaluation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            placeholder='[{"age": 35, "department": "Sales"},{"age": 25, "department": "IT"}]'
            value={batchData}
            onChange={(e) => setBatchData(e.target.value)}
            className="font-mono min-h-[200px]"
          />
          <Button 
            onClick={evaluateBatch}
            disabled={!batchData.trim() || rules.length === 0}
          >
            Evaluate Batch
          </Button>
          {batchResults.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Results:</h4>
              <div className="bg-gray-50 p-4 rounded-md overflow-auto max-h-[400px]">
                <pre className="text-sm">
                  {JSON.stringify(batchResults, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderASTSection = () => (
    <Card>
      <CardHeader>
        <CardTitle>AST Visualization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <select
            className="w-full p-2 border rounded-md"
            onChange={(e) => {
              const rule = rules.find(r => r.rule_id === parseInt(e.target.value));
              setSelectedRule(rule || null);
            }}
          >
            <option value="">Select a rule</option>
            {rules.map(rule => (
              <option key={rule.rule_id} value={rule.rule_id}>
                {rule.name}
              </option>
            ))}
          </select>
          {selectedRule && (
            <ASTVisualizer ast={selectedRule.ast} />
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Rule Engine</h1>
        <p className="text-gray-600">Create and evaluate business rules with ease.</p>
      </div>

      {renderConnectionStatus()}

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="evaluation">Evaluation Data</TabsTrigger>
          <TabsTrigger value="batch">Batch Evaluation</TabsTrigger>
          <TabsTrigger value="ast">AST Visualization</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex space-x-4">
            {renderCreateRuleDialog()}
            <Button 
              onClick={() => setShowCombineDialog(true)}
              disabled={selectedRules.length < 2}
            >
              Combine Selected Rules
            </Button>
          </div>
          {renderRulesList()}
          {renderCombineRulesDialog()}
        </TabsContent>

        <TabsContent value="evaluation">
          {renderEvaluationSection()}
        </TabsContent>

        <TabsContent value="batch">
          {renderBatchEvaluationSection()}
        </TabsContent>

        <TabsContent value="ast">
          {renderASTSection()}
        </TabsContent>
      </Tabs>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default RuleEngine;