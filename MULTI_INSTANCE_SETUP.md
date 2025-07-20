# RAGversate Multi-Instance System

This document describes the new multi-instance HelixDB system with conversational chat interface.

## 🏗️ Architecture Overview

The system now supports **4 separate HelixDB instances** for different search modes:

1. **General Search** (Port 6969) - Current cached data
2. **Summer Programs** (Port 6970) - Summer program information
3. **Mentors** (Port 6971) - Mentor and advisor data
4. **Scholarships** (Port 6972) - Scholarship and funding information

## 📁 Directory Structure

```
helixdb-cfg/
├── general/              # General search instance
│   ├── config.hx.json
│   ├── schema.hx
│   └── source.hx
├── summer-programs/      # Summer programs instance
├── mentors/             # Mentors instance
└── scholarships/        # Scholarships instance

data/
├── websets/
│   ├── summer-programs/  # Place your CSV files here
│   ├── mentors/
│   └── scholarships/
```

## 🚀 Setup Instructions

### 1. Deploy All HelixDB Instances

```bash
# Make the script executable
chmod +x scripts/setup-multi-helixdb.sh

# Deploy all instances
./scripts/setup-multi-helixdb.sh
```

This will start all 4 HelixDB instances on their respective ports.

### 2. Migrate Current Data

```bash
# Migrate existing data to General Search instance
npx tsx scripts/migrate-to-general.ts
```

### 3. Import CSV Data (When Ready)

Place your CSV files in the appropriate directories:

```bash
# Example CSV file locations:
data/websets/summer-programs/summer_programs.csv
data/websets/mentors/mentors.csv
data/websets/scholarships/scholarships.csv
```

Then import them:

```bash
# Import all CSV data
npx tsx scripts/import-csv-data.ts
```

## 💬 Conversational Chat Interface

The new chat interface is available at `/chat` and features:

- **Mode Selection**: Choose between 4 search modes
- **Conversational Responses**: AI responds in a natural, conversational manner
- **Mode-Specific Caching**: Results are cached in the appropriate HelixDB instance
- **Real-time Chat**: Send messages and get instant responses

### Chat Modes

1. **🔍 General Search**: Search across all topics and information
2. **☀️ Summer Programs**: Find summer programs and opportunities
3. **👥 Mentor Search**: Connect with mentors and advisors
4. **💰 Scholarships**: Discover scholarships and funding

## 🔧 API Endpoints

### Chat API
- **POST** `/api/chat`
- **Body**: `{ message: string, mode: SearchMode }`
- **Response**: Conversational response with search results

### Health Check
- **GET** `/api/health` - Check all instance health

## 📊 Data Management

### Adding New Data

1. **Web Search Results**: Automatically cached in the active mode's instance
2. **CSV Import**: Use the import script for bulk data
3. **Manual Entry**: Use the API to create entities

### Data Migration

- Current data is automatically moved to the General Search instance
- Each mode maintains its own separate database
- No cross-contamination between different search modes

## 🛠️ Development

### Adding New Search Modes

1. Create new config directory: `helixdb-cfg/new-mode/`
2. Copy config files from existing mode
3. Update `PORT_CONFIG` in `multi-helixdb.ts`
4. Add mode to `SearchMode` type
5. Update UI components

### Monitoring

```bash
# Check instance status
lsof -i :6969-6972

# Stop all instances
pkill -f 'helix deploy'

# View logs
tail -f helixdb-cfg/*/logs/*
```

## 🎯 Key Features

- **Multi-Instance Architecture**: Separate databases for different content types
- **Conversational UI**: Natural chat interface instead of search form
- **Mode-Specific Caching**: Results cached in appropriate instance
- **Scalable Design**: Easy to add new search modes
- **Data Isolation**: No cross-contamination between modes

## 🔄 Migration from Old System

1. **Data**: Current data automatically moved to General Search
2. **UI**: Main page redirects to new chat interface
3. **API**: New conversational API replaces old search API
4. **Caching**: Multi-instance caching system

## 📝 CSV File Format

Your CSV files should include these columns:

### Summer Programs
- `Program Name` (required)
- `Description` (required)
- `Category` (optional)
- `Source` (optional)

### Mentors
- `Name` (required)
- `Bio` (required)
- `Field` (optional)
- `Institution` (optional)

### Scholarships
- `Scholarship Name` (required)
- `Description` (required)
- `Category` (optional)
- `Provider` (optional)

## 🚨 Important Notes

- Each HelixDB instance runs on a different port
- Data is isolated between instances
- The chat interface is the new primary interface
- Old search interface is still available at `/search`
- All instances must be running for full functionality

## 🆘 Troubleshooting

### Instance Not Starting
```bash
# Check if port is in use
lsof -i :6969

# Kill existing process
kill -9 <PID>

# Restart instance
cd helixdb-cfg/general && helix deploy --port 6969
```

### Data Not Loading
```bash
# Check instance health
curl http://localhost:6969/health

# Restart all instances
./scripts/setup-multi-helixdb.sh
```

### Chat Not Working
```bash
# Check if all instances are running
lsof -i :6969-6972

# Restart the application
npm run dev
``` 