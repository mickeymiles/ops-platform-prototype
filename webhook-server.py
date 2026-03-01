#!/usr/bin/env python3
"""
Webhook server for auto-deployment
Receives GitHub push events and triggers deployment
"""

import http.server
import socketserver
import json
import subprocess
import os
import threading

PORT = 9007  # Webhook 接收端口
DEPLOY_DIR = "/var/www/war-room"
SERVE_PORT = 9006  # 静态文件服务端口

class WebhookHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/webhook/ops-platform':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                print(f"Received webhook: {data.get('ref', 'unknown')}")
                
                # 触发部署
                threading.Thread(target=self.deploy).start()
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "deploying"}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b"Webhook server is running")
    
    def deploy(self):
        """执行部署"""
        try:
            print("Starting deployment...")
            os.chdir(DEPLOY_DIR)
            
            # 拉取最新代码
            subprocess.run(['git', 'pull', 'origin', 'master'], check=True)
            print("Code pulled successfully")
            
            # 重启静态文件服务
            subprocess.run(['pkill', '-f', f'http.server {SERVE_PORT}'], check=False)
            subprocess.Popen([
                'nohup', 'python3', '-m', 'http.server', str(SERVE_PORT), 
                '--bind', '0.0.0.0'
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"Server restarted on port {SERVE_PORT}")
            
        except Exception as e:
            print(f"Deployment failed: {e}")

if __name__ == '__main__':
    with socketserver.TCPServer(("0.0.0.0", PORT), WebhookHandler) as httpd:
        print(f"Webhook server running on port {PORT}")
        print(f"Deploy target: http://118.145.117.14:{SERVE_PORT}")
        httpd.serve_forever()
