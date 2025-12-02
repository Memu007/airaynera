#!/usr/bin/env node

/**
 * 🏥 AIRA Medical System - n8n Workflow Builder via MCP
 *
 * Script para crear el workflow de optimización de sesiones usando MCP
 */

const { spawn } = require('child_process');
const path = require('path');

class N8NWorkflowBuilder {
    constructor() {
        this.workspaceDir = '/Users/Emi/Downloads/beiabot/beiabot-master';
        this.workflowName = 'aira-session-optimization';
    }

    async createWorkflow() {
        console.log('🏥 AIRA Medical System - n8n Workflow Builder');
        console.log('🔧 Creando workflow de optimización de sesiones...');
        console.log('');

        try {
            // 1. Crear workflow base
            await this.executeMCPCommand('create_workflow', {
                workflow_name: this.workflowName,
                workspace_dir: this.workspaceDir
            });

            console.log('✅ Workflow base creado');

            // 2. Añadir nodos en secuencia
            const nodes = [
                {
                    type: 'webhook',
                    name: 'WhatsApp Webhook',
                    position: { x: 240, y: 300 },
                    parameters: {
                        httpMethod: 'POST',
                        path: 'whatsapp',
                        responseMode: 'responseNode'
                    }
                },
                {
                    type: 'openAi',
                    name: 'Gemini 2.0 Analysis',
                    position: { x: 460, y: 300 },
                    parameters: {
                        model: 'gemini-2.0-flash-exp',
                        options: {
                            temperature: 0.3,
                            maxTokens: 1000
                        },
                        prompt: 'Analiza el siguiente mensaje de WhatsApp para reconocimiento de paciente: {{ $json.body }}'
                    }
                },
                {
                    type: 'httpRequest',
                    name: 'AIRA API Session',
                    position: { x: 680, y: 300 },
                    parameters: {
                        method: 'POST',
                        url: 'http://localhost:8082/api/session/create',
                        authentication: 'genericCredentialType',
                        genericAuthType: 'httpHeaderAuth',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer aira_optimization_secret_2025'
                        },
                        jsonBody: '={{ $json }}'
                    }
                },
                {
                    type: 'webhook',
                    name: 'Response Webhook',
                    position: { x: 900, y: 300 },
                    parameters: {
                        responseMode: 'responseNode',
                        respondWith: 'json',
                        responseBody: '={{ $json }}'
                    }
                }
            ];

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const connectFrom = i > 0 ? [{ node_id: `node_${i}`, output_name: 'main' }] : undefined;

                await this.executeMCPCommand('add_node', {
                    workflow_name: this.workflowName,
                    node_type: node.type,
                    node_name: node.name,
                    position: node.position,
                    parameters: node.parameters,
                    connect_from: connectFrom
                });

                console.log(`✅ Nodo "${node.name}" agregado`);
            }

            console.log('');
            console.log('🎉 Workflow de optimización creado exitosamente');
            console.log('📁 Ubicación: workflow_data/aira-session-optimization.json');
            console.log('🔗 Listo para importar en n8n');

        } catch (error) {
            console.error('❌ Error creando workflow:', error.message);
            throw error;
        }
    }

    async executeMCPCommand(command, params) {
        return new Promise((resolve, reject) => {
            const mcpProcess = spawn('npx', ['-y', 'n8n-workflow-builder-mcp'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    NODE_ENV: 'production'
                }
            });

            const request = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: command,
                    arguments: params
                }
            };

            let stdout = '';
            let stderr = '';

            mcpProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            mcpProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            mcpProcess.on('close', (code) => {
                try {
                    const response = JSON.parse(stdout);
                    if (response.error) {
                        reject(new Error(response.error.message));
                    } else {
                        resolve(response.result);
                    }
                } catch (e) {
                    // Si no es JSON, asumir éxito por salida estándar
                    if (code === 0) {
                        resolve({ success: true });
                    } else {
                        reject(new Error(`Command failed: ${stderr || stdout}`));
                    }
                }
            });

            mcpProcess.on('error', (error) => {
                reject(error);
            });

            // Enviar comando
            mcpProcess.stdin.write(JSON.stringify(request) + '\n');
            mcpProcess.stdin.end();

            // Timeout
            setTimeout(() => {
                mcpProcess.kill();
                reject(new Error('Command timeout'));
            }, 30000);
        });
    }
}

// Ejecutar creación del workflow
if (require.main === module) {
    const builder = new N8NWorkflowBuilder();

    builder.createWorkflow()
        .then(() => {
            console.log('✅ Workflow creation completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Workflow creation failed:', error);
            process.exit(1);
        });
}

module.exports = N8NWorkflowBuilder;