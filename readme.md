# Rule Engine with AST

A powerful rule engine application that allows dynamic creation, combination, and evaluation of business rules using Abstract Syntax Trees (AST). Built with FastAPI, Next.js, and PostgreSQL.

## Features

- 🌳 AST-based rule representation
- 🔄 Dynamic rule creation and combination
- ⚡ Real-time rule evaluation
- 📊 Visual AST representation
- 🔍 Batch evaluation support
- 💾 PostgreSQL persistence
- 🎨 Modern UI with shadcn/ui components

## Architecture

### Frontend (Next.js)
- Built with React and Next.js
- Uses shadcn/ui components for UI elements
- Features React Flow for AST visualization
- Responsive and intuitive interface

### Backend (FastAPI)
- RESTful API built with FastAPI
- Efficient rule parsing and evaluation
- PostgreSQL integration for rule storage
- Support for batch operations

### Data Storage (PostgreSQL)
```sql
CREATE TABLE rules (
    rule_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_string TEXT NOT NULL,
    ast JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
## Project Structure

```
rule-engine/
├── rule-engine-frontend/
    ├── src/
       ├── components/
       │   └── RuleBuilder.tsx    
       ├── lib/
       │   └── utils.ts 
       └── app/
          ├── globals.css
          ├── layout.tsx
          └── page.tsx
└── backend/
      │    
      ├── requirements.txt
      └── main.py
```
## Prerequisites

- Python 3.8+
- Node.js 18+
- PostgreSQL 12+
- pnpm (recommended) or npm

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd rule-engine
```

2. Set up the backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```

3. Configure PostgreSQL:
- Create a database named `rule_engine`
- Update the DB_CONFIG in `main.py` with your credentials:
```python
DB_CONFIG = {
    "dbname": "rule_engine",
    "user": "your_username",
    "password": "your_password",
    "host": "localhost",
    "port": "5432"
}
```

4. Set up the frontend:
```bash
cd frontend
pnpm install
```

## Running the Application

1. Start the backend server:
```bash
cd backend
uvicorn main:app --reload
```

2. Start the frontend development server:
```bash
cd frontend
pnpm dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Rule Syntax

Rules follow a specific syntax for defining conditions:

```
(condition1 operator condition2) [AND/OR] (condition3)
```

Examples:
```
(age > 30 AND department = 'Sales') OR (experience >= 5)
((age > 30 AND department = 'Marketing')) AND (salary > 20000 OR experience > 5)
```

Supported operations:
- Comparison: `>`, `<`, `=`, `>=`, `<=`
- Logical: `AND`, `OR`
- Grouping: `(`, `)`

## API Endpoints

### Rules Management
- `POST /rules/` - Create a new rule
- `GET /rules/` - List all rules
- `DELETE /rules/{rule_id}` - Delete a rule
- `POST /rules/combine` - Combine multiple rules

### Rule Evaluation
- `POST /rules/evaluate/{rule_id}` - Evaluate a single rule
- `POST /rules/evaluate-batch` - Batch evaluate multiple rules

### Health Check
- `GET /health` - Check system health

## Frontend Features

1. Rule Management
   - Create new rules with name and description
   - View existing rules
   - Delete rules
   - Combine multiple rules

2. Rule Evaluation
   - Single rule evaluation
   - Batch evaluation
   - JSON data input with formatting

3. AST Visualization
   - Interactive tree visualization
   - Node relationship display
   - Visual representation of rule logic

## Error Handling

The system includes comprehensive error handling for:
- Invalid rule syntax
- Missing operators
- Invalid JSON data
- Database connection issues
- API errors

## Performance Considerations

1. Database Optimization
   - Indexed rule_id for faster lookups
   - JSONB type for efficient AST storage
   - Proper connection management

2. Batch Operations
   - Support for evaluating multiple rules
   - Efficient data processing
   - Connection pooling

## Future Enhancements

1. Rule Templates
   - Pre-defined rule templates
   - Common pattern support
   - Template management

2. Version Control
   - Rule versioning
   - Change history
   - Rollback support

3. Advanced Features
   - Custom functions support
   - Complex rule patterns
   - Rule optimization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- FastAPI for the backend framework
- Next.js for the frontend framework
- shadcn/ui for the UI components
- React Flow for AST visualization
