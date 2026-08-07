import json
import os

collection_path = r"d:\Project\LMS\backend\Elearning_english.postman_collection.json"

if not os.path.exists(collection_path):
    print(f"Error: Collection file not found at {collection_path}")
    exit(1)

with open(collection_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Helper to build a standard GET list request
def make_get_list_request(name, path_list):
    path_str = "/".join(path_list)
    return {
        "name": name,
        "request": {
            "method": "GET",
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
                "raw": f"{{{{baseUrl}}}}/{path_str}",
                "host": [
                    "{{baseUrl}}"
                ],
                "path": path_list
            }
        },
        "response": [],
        "event": [
            {
                "listen": "test",
                "script": {
                    "exec": [
                        "pm.test(\"Status code is 200\", function () {",
                        "    pm.response.to.have.status(200);",
                        "});"
                    ],
                    "type": "text/javascript"
                }
            }
        ]
    }

# 1. Update Admin CRUD folder item listings
admin_folder = None
for folder in data.get('item', []):
    if folder.get('name') == '8. Admin CRUD':
        admin_folder = folder
        break

if admin_folder:
    print("Found '8. Admin CRUD' folder. Checking subfolders...")
    for sub in admin_folder.get('item', []):
        sub_name = sub.get('name')
        sub_items = sub.get('item', [])
        
        # Check if already present to avoid duplication
        exists = lambda n: any(x.get('name') == n for x in sub_items)
        
        if sub_name == "Categories Management" and not exists("Get All Categories"):
            sub_items.insert(0, make_get_list_request("Get All Categories", ["admin", "categories"]))
            print("Added 'Get All Categories'")
            
        elif sub_name == "Modules Management" and not exists("Get All Modules"):
            sub_items.insert(0, make_get_list_request("Get All Modules", ["admin", "modules"]))
            print("Added 'Get All Modules'")
            
        elif sub_name == "Lessons Management" and not exists("Get All Lessons"):
            sub_items.insert(0, make_get_list_request("Get All Lessons", ["admin", "lessons"]))
            print("Added 'Get All Lessons'")
            
        elif sub_name == "Quizzes Management" and not exists("Get All Quizzes"):
            sub_items.insert(0, make_get_list_request("Get All Quizzes", ["admin", "quizzes"]))
            print("Added 'Get All Quizzes'")
            
        elif sub_name == "Templates Management" and not exists("Get All Certificate Templates"):
            sub_items.insert(0, make_get_list_request("Get All Certificate Templates", ["admin", "certificate-templates"]))
            print("Added 'Get All Certificate Templates'")

# 2. Add Tutor Operations folder at the end
tutor_folder_exists = any(x.get('name') == '9. Tutor Operations' for x in data.get('item', []))
if not tutor_folder_exists:
    tutor_folder = {
        "name": "9. Tutor Operations",
        "item": [
            make_get_list_request("Get Student Submissions", ["tutor", "submissions"]),
            {
                "name": "Submit Tutor Review",
                "request": {
                    "method": "POST",
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
                        "raw": "{{baseUrl}}/tutor/submissions/:attemptId/review",
                        "host": [
                            "{{baseUrl}}"
                        ],
                        "path": [
                            "tutor",
                            "submissions",
                            ":attemptId",
                            "review"
                        ],
                        "variable": [
                            {
                                "key": "attemptId",
                                "value": "10"
                            }
                        ]
                    },
                    "body": {
                        "mode": "raw",
                        "raw": "{\n    \"feedback\": \"Great pronunciation, keep practicing word stress on tenses.\"\n}",
                        "options": {
                            "raw": {
                                "language": "json"
                            }
                        }
                    }
                },
                "response": [],
                "event": [
                    {
                        "listen": "test",
                        "script": {
                            "exec": [
                                "pm.test(\"Status code is 200\", function () {",
                                "    pm.response.to.have.status(200);",
                                "});"
                            ],
                            "type": "text/javascript"
                        }
                    }
                ]
            }
        ]
    }
    data['item'].append(tutor_folder)
    print("Added '9. Tutor Operations' folder.")

# Save modified collection back
with open(collection_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4, ensure_ascii=False)

print("Postman collection updated successfully!")
