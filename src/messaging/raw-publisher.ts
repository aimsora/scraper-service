import { connect, type Channel, type ChannelModel } from "amqplib";
import type { RawSourceEvent } from "../types";

export class RawPublisher {
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(
    private readonly rabbitmqUrl: string,
    private readonly queueName: string
  ) {}

  async init(additionalQueues: string[] = []): Promise<void> {
    this.connection = await connect(this.rabbitmqUrl);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue(this.queueName, { durable: true });
    await Promise.all(
      additionalQueues.map((queueName) => this.channel?.assertQueue(queueName, { durable: true }))
    );
  }

  async publish(event: RawSourceEvent): Promise<void> {
    if (!this.channel) {
      throw new Error("RawPublisher is not initialized");
    }

    this.channel.sendToQueue(this.queueName, Buffer.from(JSON.stringify(event)), {
      contentType: "application/json",
      persistent: true
    });
  }

  async publishTo(queueName: string, payload: unknown): Promise<void> {
    if (!this.channel) {
      throw new Error("RawPublisher is not initialized");
    }

    await this.channel.assertQueue(queueName, { durable: true });
    this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), {
      contentType: "application/json",
      persistent: true
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
