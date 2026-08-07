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
                        f"pm.test(\"Status code is 200 or 201\", function () {{",
                        f"    pm.expect(pm.response.code).to.be.oneOf([200, 201]);",
                        f"}});"
                    ],
                    "type": "text/javascript"
                }
            }
        ]
    }

# Find Admin CRUD folder
admin_folder = None
for folder in data.get('item', []):
    if folder.get('name') == '8. Admin CRUD':
        admin_folder = folder
        break

if admin_folder:
    subfolders = admin_folder.get('item', [])
    
    # 1. Add Users Management
    if not any(x.get('name') == 'Users Management' for x in subfolders):
        users_crud = {
            "name": "Users Management",
            "item": [
                make_request("Get All Users", "GET", ["admin", "users"]),
                make_request("Create User", "POST", ["admin", "users"], 
                             body_raw="{\n    \"roleId\": 3,\n    \"fullName\": \"Tutor Jane\",\n    \"email\": \"jane_tutor@example.com\",\n    \"username\": \"janetutor\",\n    \"password\": \"Password123\",\n    \"status\": \"ACTIVE\"\n}"),
                make_request("Update User", "PUT", ["admin", "users", ":id"],
                             body_raw="{\n    \"fullName\": \"Tutor Jane (Updated)\",\n    \"status\": \"ACTIVE\"\n}",
                             variables=[{"key": "id", "value": "1"}]),
                make_request("Delete User", "DELETE", ["admin", "users", ":id"],
                             variables=[{"key": "id", "value": "1"}])
            ]
        }
        subfolders.insert(0, users_crud)
        print("Added 'Users Management' subfolder.")
        
    # 2. Add Speaking Tests Management
    if not any(x.get('name') == 'Speaking Tests Management' for x in subfolders):
        speaking_crud = {
            "name": "Speaking Tests Management",
            "item": [
                make_request("Get All Speaking Tests", "GET", ["admin", "speaking-tests"]),
                make_request("Create Speaking Test", "POST", ["admin", "speaking-tests"],
                             body_raw="{\n    \"assessmentId\": 1,\n    \"title\": \"Present Tenses AI Challenge\",\n    \"instruction\": \"Read aloud correctly\"\n}"),
                make_request("Update Speaking Test", "PUT", ["admin", "speaking-tests", ":id"],
                             body_raw="{\n    \"title\": \"Present Tenses Pronunciation Test\"\n}",
                             variables=[{"key": "id", "value": "1"}]),
                make_request("Delete Speaking Test", "DELETE", ["admin", "speaking-tests", ":id"],
                             variables=[{"key": "id", "value": "1"}]),
                make_request("Create Speaking Prompt", "POST", ["admin", "speaking-tests", ":testId", "prompts"],
                             body_raw="{\n    \"promptType\": \"READING\",\n    \"promptText\": \"She works as an English translator.\",\n    \"promptOrder\": 1\n}",
                             variables=[{"key": "testId", "value": "1"}]),
                make_request("Update Speaking Prompt", "PUT", ["admin", "speaking-tests", "prompts", ":promptId"],
                             body_raw="{\n    \"promptText\": \"She is working as an English translator now.\"\n}",
                             variables=[{"key": "promptId", "value": "1"}]),
                make_request("Delete Speaking Prompt", "DELETE", ["admin", "speaking-tests", "prompts", ":promptId"],
                             variables=[{"key": "promptId", "value": "1"}])
            ]
        }
        subfolders.append(speaking_crud)
        print("Added 'Speaking Tests Management' subfolder.")

    # 3. Add Quiz Questions & Options CRUD to Quizzes Management subfolder
    for sub in subfolders:
        if sub.get('name') == "Quizzes Management":
            quiz_items = sub.get('item', [])
            exists = lambda n: any(x.get('name') == n for x in quiz_items)
            
            if not exists("Create Quiz Question"):
                quiz_items.append(make_request("Create Quiz Question", "POST", ["admin", "quizzes", ":quizId", "questions"],
                                               body_raw="{\n    \"questionCode\": \"Q03\",\n    \"questionText\": \"He _____ (study) English every day.\",\n    \"point\": 20.00,\n    \"questionOrder\": 3\n}",
                                               variables=[{"key": "quizId", "value": "1"}]))
                print("Added 'Create Quiz Question'")
                
            if not exists("Update Quiz Question"):
                quiz_items.append(make_request("Update Quiz Question", "PUT", ["admin", "quizzes", "questions", ":questionId"],
                                               body_raw="{\n    \"questionText\": \"He _____ (studies) English every single day.\"\n}",
                                               variables=[{"key": "questionId", "value": "101"}]))
                print("Added 'Update Quiz Question'")

            if not exists("Delete Quiz Question"):
                quiz_items.append(make_request("Delete Quiz Question", "DELETE", ["admin", "quizzes", "questions", ":questionId"],
                                               variables=[{"key": "questionId", "value": "101"}]))
                print("Added 'Delete Quiz Question'")

            if not exists("Create Question Option"):
                quiz_items.append(make_request("Create Question Option", "POST", ["admin", "quizzes", "questions", ":questionId", "options"],
                                               body_raw="{\n    \"optionLabel\": \"A\",\n    \"optionText\": \"study\",\n    \"isCorrect\": false,\n    \"score\": 0.00\n}",
                                               variables=[{"key": "questionId", "value": "101"}]))
                print("Added 'Create Question Option'")

            if not exists("Update Question Option"):
                quiz_items.append(make_request("Update Question Option", "PUT", ["admin", "quizzes", "questions", "options", ":optionId"],
                                               body_raw="{\n    \"optionText\": \"studies\",\n    \"isCorrect\": true,\n    \"score\": 20.00\n}",
                                               variables=[{"key": "optionId", "value": "1"}]))
                print("Added 'Update Question Option'")

            if not exists("Delete Question Option"):
                quiz_items.append(make_request("Delete Question Option", "DELETE", ["admin", "quizzes", "questions", "options", ":optionId"],
                                               variables=[{"key": "optionId", "value": "1"}]))
                print("Added 'Delete Question Option'")

with open(collection_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4, ensure_ascii=False)

print("Postman collection v2 update completed successfully!")
