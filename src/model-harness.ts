/**
 * Model-Agnostic Harness for Edge Stack Agents
 * Provides flexibility to use multiple LLM providers without lock-in
 */

export interface ModelConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ModelProvider {
  name: string;
  models: {
    architect: string; // High-end reasoning
    worker: string; // General implementation
    intern: string; // Simple tasks
  };
  client: any;
  initialize(config: ModelConfig): Promise<void>;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  usage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Anthropic Provider (Claude)
 */
export class AnthropicProvider implements ModelProvider {
  name = "anthropic";
  client: any;

  models = {
    architect: "claude-3-5-sonnet-20241022", // or opus when available
    worker: "claude-3-5-sonnet-20241022",
    intern: "claude-3-haiku-20240307",
  };

  async initialize(config: ModelConfig): Promise<void> {
    // Dynamic import to avoid runtime dependency
    const Anthropic = await import("@anthropic-ai/sdk").then((m) => m.default);
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<ChatResponse> {
    const response = await this.client.messages.create({
      model: options.model || this.models.worker,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      messages: messages.filter((m) => m.role !== "system"),
      system: messages.find((m) => m.role === "system")?.content,
    });

    return {
      content:
        response.content[0].type === "text" ? response.content[0].text : "",
      usage: {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}

/**
 * OpenAI Provider (GPT)
 */
export class OpenAIProvider implements ModelProvider {
  name = "openai";
  client: any;

  models = {
    architect: "gpt-4-turbo",
    worker: "gpt-4",
    intern: "gpt-3.5-turbo",
  };

  async initialize(config: ModelConfig): Promise<void> {
    const OpenAI = await import("openai").then((m) => m.default);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: options.model || this.models.worker,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      messages: messages,
    });

    return {
      content: response.choices[0].message.content || "",
      usage: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }
}

/**
 * Google Provider (Gemini)
 */
export class GoogleProvider implements ModelProvider {
  name = "google";
  client: any;

  models = {
    architect: "gemini-1.5-pro",
    worker: "gemini-1.5-pro",
    intern: "gemini-1.5-flash",
  };

  async initialize(config: ModelConfig): Promise<void> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<ChatResponse> {
    const model = this.client.getGenerativeModel({
      model: options.model || this.models.worker,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
      },
    });

    // Convert messages for Gemini format
    const systemInstruction = messages.find(
      (m) => m.role === "system",
    )?.content;
    const chatHistory = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const chat = model.startChat({
      history: chatHistory.slice(0, -1),
      systemInstruction: systemInstruction,
    });

    const result = await chat.sendMessage(
      messages[messages.length - 1].content,
    );

    return {
      content: result.response.text(),
      usage: {
        prompt: 0, // Gemini doesn't provide token usage
        completion: 0,
        total: 0,
      },
    };
  }
}

/**
 * Local Provider (Ollama, LM Studio, etc.)
 */
export class LocalProvider implements ModelProvider {
  name = "local";
  client: any;

  models = {
    architect: "llama3.1:70b",
    worker: "llama3.1:8b",
    intern: "llama3.1:8b",
  };

  async initialize(config: ModelConfig): Promise<void> {
    this.client = {
      baseURL: config.baseURL || "http://localhost:11434",
      model: config.model || "llama3.1:8b",
    };
  }

  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<ChatResponse> {
    const response = await fetch(`${this.client.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model || this.client.model,
        messages: messages,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 4096,
        },
      }),
    });

    const data = await response.json();

    return {
      content: data.message?.content || "",
      usage: {
        prompt: data.prompt_eval_count || 0,
        completion: data.eval_count || 0,
        total: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }
}

/**
 * Provider Registry and Management
 */
export class ModelHarness {
  private providers = new Map<string, ModelProvider>();
  private primary: ModelProvider | null = null;
  private fallbacks: ModelProvider[] = [];

  register(provider: ModelProvider) {
    this.providers.set(provider.name, provider);
  }

  async initialize(configs: Record<string, ModelConfig>): Promise<void> {
    // Initialize all registered providers
    for (const [name, provider] of this.providers) {
      if (configs[name]) {
        try {
          await provider.initialize(configs[name]);
          console.log(`✅ Initialized ${name} provider`);

          // Set primary to first successful initialization
          if (!this.primary) {
            this.primary = provider;
          } else {
            this.fallbacks.push(provider);
          }
        } catch (error) {
          console.warn(`⚠️  Failed to initialize ${name}: ${error}`);
        }
      }
    }

    if (!this.primary) {
      throw new Error("No model providers initialized successfully");
    }
  }

  async chat(
    messages: ChatMessage[],
    mode: "architect" | "worker" | "intern",
    options: ChatOptions = {},
  ): Promise<ChatResponse> {
    let lastError: Error | null = null;

    // Try primary provider first
    if (this.primary) {
      try {
        const model = this.primary.models[mode];
        return await this.primary.chat(messages, { ...options, model });
      } catch (error) {
        lastError = error as Error;
        console.warn(`Primary provider failed: ${error}`);
      }
    }

    // Try fallback providers
    for (const provider of this.fallbacks) {
      try {
        const model = provider.models[mode];
        return await provider.chat(messages, { ...options, model });
      } catch (error) {
        console.warn(`Fallback ${provider.name} failed: ${error}`);
        lastError = error as Error;
      }
    }

    throw lastError || new Error("All providers failed");
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getPrimaryProvider(): string | null {
    return this.primary?.name || null;
  }
}

// Create and configure the harness
export const harness = new ModelHarness();

// Register all available providers
harness.register(new AnthropicProvider());
harness.register(new OpenAIProvider());
harness.register(new GoogleProvider());
harness.register(new LocalProvider());

// Example configuration
export const defaultConfig: Record<string, ModelConfig> = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-3-5-sonnet-20241022",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: "gpt-4",
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY || "",
    model: "gemini-1.5-pro",
  },
  local: {
    apiKey: "", // Not needed for local
    baseURL: process.env.LOCAL_LLM_URL || "http://localhost:11434",
    model: "llama3.1:8b",
  },
};
