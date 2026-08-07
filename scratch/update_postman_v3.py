import json
import os

collection_path = r"d:\Project\LMS\backend\Elearning_english.postman_collection.json"

if not os.path.exists(collection_path):
    print(f"Error: Collection file not found at {collection_path}")
    exit(1)

with open(collection_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Helper to build request dictionary
def make_request(name, method, path_list, body_raw=None, variables=None):
    raw_url = "{{baseUrl}}/" + "/".join(path_list)
    request_dict = {
        "method": method,
        "header": [
            {
                "key": "Content-Type",
                "value": "application/json",
                "type": "text"
            },
            {
                "key": "Authorization",
                "value": "Bearer {{token}}",
                "type": "text"
            }
        ],
        "url": {
            "raw": raw_url,
            "host": [
                "{{baseUrl}}"
            ],
            "path": path_list
        }
    }
    if body_raw:
        request_dict["body"] = {
            "mode": "raw",
            "raw": body_raw,
            "options": {
                "raw": {
                    "language": "json"
                }
            }
        }
    if variables:
        request_dict["url"]["variable"] = variables
        
    return {
        "name": name,
        "request": request_dict,
        "response": [],
        "event": [
            {
                "listen": "test",
                "script": {
                    "exec": [
                        "pm.test(\"Status code is 200 or 201\", function () {",
                        "    pm.expect(pm.response.code).to.be.oneOf([200, 201]);",
                        "});"
                    ],
                    "type": "text/javascript"
                }
            }
        ]
    }

# 1. Add Orders Management under Admin CRUD folder
admin_folder = None
for folder in data.get('item', []):
    if folder.get('name') == '8. Admin CRUD':
        admin_folder = folder
        break

if admin_folder:
    subfolders = admin_folder.get('item', [])
    if not any(x.get('name') == 'Orders Management' for x in subfolders):
        orders_crud = {
            "name": "Orders Management",
            "item": [
                make_request("Get All Orders", "GET", ["admin", "orders"]),
                make_request("Update Order Status (Manual Confirm)", "PUT", ["admin", "orders", ":id", "status"],
                             body_raw="{\n    \"orderStatus\": \"SUCCESS\",\n    \"paymentStatus\": \"PAID\"\n}",
                             variables=[{"key": "id", "value": "1"}])
            ]
        }
        subfolders.append(orders_crud)
        print("Added 'Orders Management' subfolder under Admin CRUD.")

# 2. Add Get Quizzes by Type under Quizzes folder
quizzes_folder = None
for folder in data.get('item', []):
    if folder.get('name') == '5. Quizzes':
        quizzes_folder = folder
        break

if quizzes_folder:
    quiz_items = quizzes_folder.get('item', [])
    if not any(x.get('name') == 'Get Quizzes by Type' for x in quiz_items):
        quiz_items.insert(0, make_request("Get Quizzes by Type", "GET", ["quizzes", "type", ":typeCode"],
                                          variables=[{"key": "typeCode", "value": "QUIZ"}]))
        print("Added 'Get Quizzes by Type' request under Quizzes folder.")

with open(collection_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4, ensure_ascii=False)

print("Postman collection v3 update completed successfully!")
