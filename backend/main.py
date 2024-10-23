# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Union, Any
import psycopg2
from psycopg2.extras import Json
from enum import Enum

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
DB_CONFIG = {
    "dbname": "rule_engine",
    "user": "postgres",
    "password": "rajul",
    "host": "localhost",
    "port": "5432"
}

class NodeType(str, Enum):
    OPERATOR = "operator"
    OPERAND = "operand"
    COMPARISON = "comparison"

class Node(BaseModel):
    type: NodeType
    value: Optional[str]
    left: Optional[Dict] = None
    right: Optional[Dict] = None

class Rule(BaseModel):
    rule_id: Optional[int]
    name: str
    description: str
    rule_string: str
    ast: Dict

class RuleInput(BaseModel):
    rule_string: str
    name: str
    description: str

class EvaluationData(BaseModel):
    data: Dict[str, Union[str, int, float]]

class CombinedRuleInput(BaseModel):
    rules: List[int]
    operator: str  # 'AND' or 'OR'
    name: str
    description: str

class BatchEvaluationInput(BaseModel):
    rule_ids: List[int]
    data_list: List[Dict[str, Any]]

def create_tables():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS rules (
            rule_id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            rule_string TEXT NOT NULL,
            ast JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    cur.close()
    conn.close()

def parse_rule(rule_string: str) -> Node:
    def tokenize(s: str) -> List[str]:
        s = s.replace('(', ' ( ').replace(')', ' ) ')
        return [token.strip() for token in s.split() if token.strip()]
    
    def build_ast(tokens: List[str]) -> Dict:
        if not tokens:
            raise ValueError("Empty rule string")
            
        token = tokens.pop(0)
        
        if token == '(':
            left = build_ast(tokens)
            op = tokens.pop(0)  # AND/OR
            right = build_ast(tokens)
            tokens.pop(0)  # Remove closing parenthesis
            return {
                "type": "operator",
                "value": op,
                "left": left,
                "right": right
            }
        else:
            # Handle comparison operations
            field = token
            op = tokens.pop(0)
            value = tokens.pop(0)
            return {
                "type": "comparison",
                "value": op,
                "left": {"type": "operand", "value": field},
                "right": {"type": "operand", "value": value}
            }
    
    tokens = tokenize(rule_string)
    return build_ast(tokens)

def evaluate_node(node: Dict, data: Dict) -> bool:
    if node["type"] == "operator":
        left_result = evaluate_node(node["left"], data)
        right_result = evaluate_node(node["right"], data)
        
        if node["value"] == "AND":
            return left_result and right_result
        elif node["value"] == "OR":
            return left_result or right_result
            
    elif node["type"] == "comparison":
        field = node["left"]["value"]
        op = node["value"]
        expected_value = node["right"]["value"]
        
        if field not in data:
            raise ValueError(f"Field {field} not found in data")
            
        actual_value = data[field]
        
        if isinstance(actual_value, (int, float)):
            try:
                expected_value = expected_value.strip("'").strip('"')
                expected_value = float(expected_value)
                if isinstance(actual_value, int):
                    expected_value = int(expected_value)
            except ValueError:
                raise ValueError(f"Cannot compare numeric field '{field}' with non-numeric value '{expected_value}'")
        else:
            expected_value = expected_value.strip("'").strip('"')
            
        if op == '>':
            return actual_value > expected_value
        elif op == '<':
            return actual_value < expected_value
        elif op == '=':
            return actual_value == expected_value
        elif op == '>=':
            return actual_value >= expected_value
        elif op == '<=':
            return actual_value <= expected_value
            
    return False

@app.get("/health")
async def health_check():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        
        return {
            "status": "healthy",
            "database": "connected",
            "details": "Database connection successful"
        }
    except psycopg2.Error as e:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e)
            }
        )

@app.post("/rules/", response_model=Rule)
async def create_rule(rule_input: RuleInput):
    try:
        ast = parse_rule(rule_input.rule_string)
        
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        cur.execute(
            """
            INSERT INTO rules (name, description, rule_string, ast)
            VALUES (%s, %s, %s, %s)
            RETURNING rule_id
            """,
            (rule_input.name, rule_input.description, rule_input.rule_string, Json(ast))
        )
        
        rule_id = cur.fetchone()[0]
        conn.commit()
        
        return Rule(
            rule_id=rule_id,
            name=rule_input.name,
            description=rule_input.description,
            rule_string=rule_input.rule_string,
            ast=ast
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/rules/", response_model=List[Rule])
async def get_rules():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    cur.execute("SELECT rule_id, name, description, rule_string, ast FROM rules")
    rules = []
    for row in cur.fetchall():
        rules.append(Rule(
            rule_id=row[0],
            name=row[1],
            description=row[2],
            rule_string=row[3],
            ast=row[4]
        ))
    
    cur.close()
    conn.close()
    return rules

@app.delete("/rules/{rule_id}")
async def delete_rule(rule_id: int):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        cur.execute("DELETE FROM rules WHERE rule_id = %s RETURNING rule_id", (rule_id,))
        deleted = cur.fetchone()
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Rule not found")
            
        conn.commit()
        return {"message": f"Rule {rule_id} deleted successfully"}
    finally:
        cur.close()
        conn.close()

@app.post("/rules/combine")
async def combine_rules(input_data: CombinedRuleInput):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        cur.execute("SELECT rule_string FROM rules WHERE rule_id = ANY(%s)", (input_data.rules,))
        rules = cur.fetchall()
        
        if len(rules) != len(input_data.rules):
            raise HTTPException(status_code=404, detail="One or more rules not found")
        
        combined_string = " " + input_data.operator + " ".join([f"({rule[0]})" for rule in rules])
        
        ast = parse_rule(combined_string)
        
        cur.execute(
            """
            INSERT INTO rules (name, description, rule_string, ast)
            VALUES (%s, %s, %s, %s)
            RETURNING rule_id
            """,
            (input_data.name, input_data.description, combined_string, Json(ast))
        )
        
        rule_id = cur.fetchone()[0]
        conn.commit()
        
        return Rule(
            rule_id=rule_id,
            name=input_data.name,
            description=input_data.description,
            rule_string=combined_string,
            ast=ast
        )
    finally:
        cur.close()
        conn.close()

@app.post("/rules/evaluate/{rule_id}")
async def evaluate_rule(rule_id: int, data: EvaluationData):
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    cur.execute("SELECT ast FROM rules WHERE rule_id = %s", (rule_id,))
    result = cur.fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    ast = result[0]
    try:
        evaluation_result = evaluate_node(ast, data.data)
        return {"result": evaluation_result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.post("/rules/evaluate-batch")
async def evaluate_batch(input_data: BatchEvaluationInput):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        cur.execute("SELECT rule_id, ast FROM rules WHERE rule_id = ANY(%s)", (input_data.rule_ids,))
        rules = {row[0]: row[1] for row in cur.fetchall()}
        
        if len(rules) != len(input_data.rule_ids):
            raise HTTPException(status_code=404, detail="One or more rules not found")
        
        results = []
        for data in input_data.data_list:
            data_results = {}
            for rule_id, ast in rules.items():
                try:
                    data_results[rule_id] = evaluate_node(ast, data)
                except Exception as e:
                    data_results[rule_id] = str(e)
            results.append({
                "data": data,
                "results": data_results
            })
        
        return {"results": results}
    finally:
        cur.close()
        conn.close()

@app.on_event("startup")
async def startup_event():
    create_tables()
