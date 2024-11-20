# Solana Transaction Monitor

A real-time transaction monitoring system for Solana blockchain, specifically tracking transactions related to Raydium AMM and PumpFun protocols.

## Features

- Real-time transaction monitoring using Yellowstone-GRPC
- Support for Raydium AMM protocol transactions
- Support for PumpFun protocol transactions
- Transaction parsing and formatting
- Event parsing for program-specific events
- Automatic reconnection on stream errors

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Yellowstone-GRPC endpoint access, check out [Shyft](https://shyft.to/)
- Access token for the GRPC service

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <repository-name>
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment example file and configure your settings:
```bash
cp .env.example .env
```

4. Edit `.env` with your actual credentials

## Usage

The project provides two main monitoring scripts:

### Raydium AMM Monitor

To monitor Raydium AMM transactions:
```bash
node raydium.js
```

### PumpFun Protocol Monitor

To monitor PumpFun protocol transactions:
```bash
node index.js
```

## Environment Variables

Required environment variables in `.env`:

- `ENDPOINT`: Your Yellowstone-GRPC endpoint URL
- `X_TOKEN`: Your access token for the GRPC service

## Output

The monitors will output:
- Transaction signatures
- Parsed instruction data
- Program events
- Transaction timestamps
- Links to transaction details on Shyft Explorer

## Error Handling

The system automatically attempts to reconnect if the stream encounters an error, with a 1-second delay between retry attempts.
