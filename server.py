import http.server
import json
import os

PORT = 8080
latest_update = None

class DualHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        global latest_update
        if self.path == '/api/update':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                latest_update = data
                print(f"Received update from AI: {data}")
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        global latest_update
        if self.path == '/api/latest':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if latest_update is not None:
                self.wfile.write(json.dumps(latest_update).encode('utf-8'))
                latest_update = None  # Consume the update
            else:
                self.wfile.write(json.dumps({}).encode('utf-8'))
        else:
            # Fallback to serving static files
            super().do_GET()

    def do_OPTIONS(self):
        # Support CORS pre-flight requests if teammate calls from another origin
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    # Make sure we serve from the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    server = http.server.HTTPServer(('0.0.0.0', PORT), DualHandler)
    print("===================================================")
    print(f" Waves Visualizer Server running at:")
    print(f" http://localhost:{PORT}")
    print("---------------------------------------------------")
    print(f" Teammate's AI can send updates to:")
    print(f" POST http://localhost:{PORT}/api/update")
    print("===================================================\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
