import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSubBlockValue } from './use-sub-block-value'
import { createLogger } from '@/lib/logs/console-logger'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'

const logger = createLogger('useWebhookState')

export function useWebhookState(blockId: string) {
    const params = useParams()
    const workflowId = params.id as string
    
    // State for webhook data
    const [webhookId, setWebhookId] = useState<string | null>(null)
    const [actualProvider, setActualProvider] = useState<string | null>(null)

    // Get values from block state
    const [webhookProvider, setWebhookProvider] = useSubBlockValue<string>(blockId, 'webhookProvider', false)
    const [webhookPath, setWebhookPath] = useSubBlockValue<string>(blockId, 'webhookPath', false)

    // Define fetch function inside useEffect to avoid dependency cycles
    useEffect(() => {
        const fetchWebhookStatus = async () => {
            try {
                const response = await fetch(`/api/webhooks?workflowId=${workflowId}`)
                if (response.ok) {
                    const data = await response.json()
                    
                    if (data.webhooks && data.webhooks.length > 0) {
                        const webhook = data.webhooks[0].webhook
                        setWebhookId(webhook.id)
                        setActualProvider(webhook.provider)

                        // Update block state if different
                        if (webhook.provider && webhook.provider !== webhookProvider) {
                            setWebhookProvider(webhook.provider)
                        }
                        if (webhook.path && webhook.path !== webhookPath) {
                            setWebhookPath(webhook.path)
                        }
                    } else {
                        // No webhook exists
                        setWebhookId(null)
                        setActualProvider(null)
                    }
                }
            } catch (error) {
                logger.error('Error checking webhook:', { error })
            }
        }

        fetchWebhookStatus()
    }, [workflowId, webhookProvider, webhookPath, setWebhookProvider, setWebhookPath])

    const updateWebhook = async (path: string, config: any) => {
        try {
            const response = await fetch('/api/webhooks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    workflowId,
                    path,
                    provider: webhookProvider || 'generic',
                    providerConfig: config,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(
                    typeof errorData.error === 'object'
                        ? errorData.error.message || JSON.stringify(errorData.error)
                        : errorData.error || 'Failed to save webhook'
                )
            }
            
            // Get the response data
            const data = await response.json()
            
            // Directly update local state with the new webhook data
            if (data.webhook) {
                setWebhookId(data.webhook.id)
                setActualProvider(data.webhook.provider)
                
                // Also update path and provider in block state if needed
                if (data.webhook.path && data.webhook.path !== webhookPath) {
                    setWebhookPath(data.webhook.path)
                }
                if (data.webhook.provider && data.webhook.provider !== webhookProvider) {
                    setWebhookProvider(data.webhook.provider)
                }
                
                // Force a workflow store update to ensure all components re-render
                useWorkflowStore.getState().triggerUpdate()
            }
        } catch (error) {
            logger.error('Error updating webhook:', { error })
            throw error
        }
    }

    const deleteWebhook = async () => {
        if (!webhookId) return

        try {
            const response = await fetch(`/api/webhooks/${webhookId}`, {
                method: 'DELETE',
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to delete webhook')
            }

            // Immediately clear local state
            setWebhookId(null)
            setActualProvider(null)
            
            // Force a workflow store update to ensure all components re-render
            useWorkflowStore.getState().triggerUpdate()
          
        } catch (error) {
            logger.error('Error deleting webhook:', { error })
            throw error
        }
    }

    const isWebhookConnected = Boolean(webhookId && webhookProvider)

    return {
        isWebhookConnected,
        webhookProvider,
        webhookId,
        actualProvider,
        webhookPath,
        updateWebhook,
        deleteWebhook
    }
}