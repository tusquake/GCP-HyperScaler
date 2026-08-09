# Step 1: Base Image
FROM node:18-alpine

# Step 2: Set Working Directory
WORKDIR /usr/src/app

# Step 3: Copy Application Files
COPY app.js ./

# Step 4: Expose Application Port
EXPOSE 3000

# Step 5: Specify Unprivileged User
USER node

# Step 6: Define Container Startup Command
CMD ["node", "app.js"]
