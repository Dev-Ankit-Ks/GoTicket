const { kafka } = require('./config/kafka');

async function main() {
    const consumer = kafka.consumer({
        groupId: 'notification-debug-group',
    });

    consumer.on(consumer.events.CRASH, (event) => {
        console.error('Consumer crashed:', event.payload.error);
    });

    try {
        await consumer.connect();
        console.log('Connected');

        await consumer.subscribe({
            topic: 'notification.otp-email',
            fromBeginning: false,
        });
        console.log('Subscribed');

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                console.log('MESSAGE RECEIVED:', {
                    topic,
                    partition,
                    offset: message.offset,
                    value: message.value?.toString(),
                });
            },
        });

        console.log('Consumer run started');
    } catch (error) {
        console.error('Consumer test failed:', error);
    }
}

main();