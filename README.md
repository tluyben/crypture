# Crypture - Enterprise Secrets Management Platform

A comprehensive, modern secrets management platform built with Next.js 15, TypeScript, and React. Crypture provides secure, scalable, and user-friendly management of environment variables, API keys, and sensitive configuration data across multiple environments.

![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![React](https://img.shields.io/badge/React-19-blue)
![SQLite](https://img.shields.io/badge/SQLite-3-green)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-green)

## 🚀 Features Overview

### 🔐 **Authentication & Security**
- **Multi-Provider Authentication**: Email/password + OAuth (Google, GitHub, Apple)
- **Email Verification**: Secure email verification flow with React Email templates
- **JWT-based Sessions**: Secure session management with NextAuth.js
- **2FA Ready**: Authenticator app support framework in place

### 📁 **Project Management**
- **Project Organization**: Create and manage multiple projects
- **Rich Metadata**: Projects with names, descriptions, and custom icons
- **User Isolation**: Each user has their own isolated project space
- **Project Dashboard**: Clean overview of all projects with quick access

### 🌍 **Environment Management**
- **Default Environments**: Pre-configured Development, Staging, and Production
- **Custom Environments**: Add/remove environments as needed
- **Environment Isolation**: Secrets are completely isolated between environments
- **Smart Navigation**: Auto-select default configurations when switching environments

### 🔑 **Advanced Secrets Management**
- **Multiple Data Types**: Support for text, email, password, UUID, dates, integers, decimals, booleans, URLs, JSON, XML, YAML
- **Dual Editor Modes**: 
  - **Row-based Editor**: Visual key-value interface with type selection
  - **.env Editor**: Direct text editing with syntax support
- **Seamless Mode Switching**: Convert between formats without data loss
- **Secret Visibility Controls**: Show/hide sensitive values
- **One-click Copy**: Quick copy to clipboard functionality

### 🔄 **Field Synchronization**
- **Missing Field Detection**: Automatically identifies missing variables across environments
- **Visual Indicators**: Red highlighting for missing fields with clear labeling
- **Cross-Environment Copy**: One-click copying of values from environments that have the field populated
- **Smart Suggestions**: Shows which environments contain each missing field

### 📊 **Secret Configurations**
- **Multiple Configs per Environment**: Support for different configuration sets (e.g., `default`, `local`, `backup`)
- **Configuration Forking**: Duplicate configurations within or across environments
- **Visual Config Management**: Clean UI for selecting and managing configurations

### 📥📤 **Import/Export System**
- **Multiple Formats**: Support for .env, JSON, YAML, XML, and CSV
- **Flexible Import Options**: Overwrite or merge with existing secrets
- **Batch Operations**: Import/export entire configuration sets
- **Format Validation**: Proper parsing and error handling for each format

### 📈 **Audit Logging & Rollback**
- **Comprehensive Audit Trail**: Track all secret operations with detailed metadata
- **User Attribution**: Full user tracking with timestamps
- **Action Types**: Create, update, delete, bulk operations, and more
- **Rollback Functionality**: One-click rollback for:
  - Secret creation (deletes the secret)
  - Secret updates (restores previous value)
  - Secret deletion (recreates the secret)
- **Audit Log UI**: Beautiful interface for browsing change history

### 🔌 **API Token Management**
- **Secure Token Generation**: Cryptographically secure API keys with `crypt_` prefix
- **Granular Permissions**: Read/write access control per environment
- **Token Lifecycle Management**: Create, enable/disable, delete tokens
- **Usage Tracking**: Last used timestamps and activity monitoring
- **Expiration Support**: Optional token expiration dates

### 🌐 **External API Integration**
- **RESTful API**: `/api/v1/secrets` endpoint for CI/CD integration
- **Bearer Token Authentication**: Secure API access with generated tokens
- **Multiple Response Formats**: JSON and .env format responses
- **Environment Targeting**: Specify environment and configuration in requests
- **CRUD Operations**: Full create, read, update operations via API

## 🛠 Technology Stack

### **Frontend**
- **Next.js 15**: App Router with TypeScript support
- **React 19**: Latest React with concurrent features
- **shadcn/ui**: Modern, accessible UI component library
- **Tailwind CSS**: Utility-first styling with custom design system
- **Lucide React**: Beautiful, consistent icons
- **React Hook Form**: Efficient form handling and validation

### **Backend**
- **Next.js API Routes**: Server-side API endpoints
- **NextAuth.js**: Authentication with multiple providers
- **Drizzle ORM**: Type-safe database operations
- **SQLite**: Lightweight, embedded database
- **React Email**: Beautiful email templates
- **Nodemailer**: SMTP email delivery

### **Development & Build**
- **TypeScript**: Full type safety across the application
- **ESLint**: Code quality and consistency
- **Turbopack**: Fast development builds
- **Git**: Version control with comprehensive history

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (recommended: 20+)
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crypture
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

4. **Configure your environment variables** (see [Environment Setup](#environment-setup))

5. **Initialize the database**
   ```bash
   npm run db:push
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to `http://localhost:3000`

## ⚙️ Environment Setup

Create a `.env.local` file with the following configuration:

### **Required Configuration**
```env
# NextAuth Configuration
NEXTAUTH_SECRET=your-secret-key-here-minimum-32-characters
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=sqlite://./crypture.db

# Email Configuration (for verification emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
```

### **Optional OAuth Providers**
```env
# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth (optional)
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret

# Apple OAuth (optional)
APPLE_ID=your-apple-client-id
APPLE_SECRET=your-apple-client-secret
```

### **Email Setup Guide**

For Gmail SMTP:
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: Google Account → Security → 2-Step Verification → App passwords
3. Use the generated password as `SMTP_PASSWORD`

## 📊 Database Schema

The application uses SQLite with Drizzle ORM. Key tables include:

- **users**: User accounts and authentication data
- **projects**: Project organization and metadata
- **environments**: Environment definitions (dev, staging, prod, custom)
- **secretConfigs**: Configuration sets within environments
- **secrets**: Individual secret key-value pairs
- **auditLogs**: Comprehensive change tracking
- **apiTokens**: External API access tokens

## 🔌 API Reference

### **Authentication**
All API requests require authentication via:
- **Web UI**: NextAuth.js session cookies
- **External API**: Bearer token in Authorization header

### **External API Endpoints**

#### **Get Secrets**
```http
GET /api/v1/secrets?environment=production&config=default&format=json
Authorization: Bearer crypt_your-token-here
```

**Response (JSON):**
```json
{
  "project": "My Project",
  "environment": "production",
  "config": "default",
  "secrets": {
    "DATABASE_URL": "postgresql://...",
    "API_KEY": "sk-...",
    "DEBUG": "false"
  }
}
```

**Response (.env format):**
```http
GET /api/v1/secrets?environment=production&format=env
```
```env
DATABASE_URL=postgresql://...
API_KEY=sk-...
DEBUG=false
```

#### **Update Secrets**
```http
POST /api/v1/secrets
Authorization: Bearer crypt_your-token-here
Content-Type: application/json

{
  "environment": "development",
  "config": "default",
  "secrets": {
    "NEW_KEY": "new-value",
    "EXISTING_KEY": "updated-value"
  }
}
```

## 🎨 UI/UX Features

### **Modern Design System**
- **Glass Morphism**: Subtle transparency effects
- **Gradient Backgrounds**: Beautiful color transitions
- **Responsive Layout**: Works on desktop, tablet, and mobile
- **Dark Mode Ready**: Infrastructure for theme switching

### **User Experience**
- **Auto-save**: Seamless saving without explicit save buttons
- **Real-time Updates**: Live synchronization across environments
- **Keyboard Shortcuts**: Efficient navigation and actions
- **Loading States**: Clear feedback during operations
- **Error Handling**: Graceful error messages and recovery

### **Accessibility**
- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Management**: Clear focus indicators
- **Color Contrast**: WCAG AA compliant colors

## 🔒 Security Features

### **Data Protection**
- **Encryption at Rest**: Sensitive data encryption
- **Secure Transmission**: HTTPS-only in production
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Parameterized queries via ORM

### **Access Control**
- **User Isolation**: Complete data separation between users
- **Token Permissions**: Granular API access control
- **Session Management**: Secure session handling
- **Audit Trail**: Complete activity logging

### **Best Practices**
- **Environment Separation**: Isolated secret storage
- **Secret Masking**: Hidden values by default
- **Secure Token Generation**: Cryptographically secure API keys
- **Email Verification**: Verified user accounts

## 📱 Usage Examples

### **Setting Up a New Project**

1. **Create Project**
   - Click "Create Project" on dashboard
   - Add name, description, and icon
   - Project created with default environments

2. **Add Secrets**
   - Navigate to Development environment
   - Click "Add Secret" 
   - Enter key-value pairs with appropriate types
   - Use .env editor for bulk entry

3. **Sync Across Environments**
   - Switch to Staging environment
   - Missing fields highlighted in red
   - Click "Copy from" → "Development" for each field
   - Modify values as needed for staging

4. **Export for Deployment**
   - Select Production environment
   - Click "Export" → ".env"
   - Download file for deployment

### **API Integration for CI/CD**

1. **Generate API Token**
   - Open project → "API Tokens"
   - Click "Create Token"
   - Set permissions (read/write per environment)
   - Copy token (shown only once)

2. **Use in CI/CD Pipeline**
   ```bash
   # Fetch production secrets
   curl -H "Authorization: Bearer crypt_your-token" \
        "https://your-domain.com/api/v1/secrets?environment=production&format=env" \
        -o .env.production
   
   # Deploy with secrets
   docker build --secret id=env,src=.env.production .
   ```

### **Audit and Rollback**

1. **View Change History**
   - Click "Audit Log" button
   - Browse chronological change history
   - See user attribution and timestamps

2. **Rollback Changes**
   - Find the change to rollback
   - Click "Rollback" button
   - Confirm the operation
   - Change is automatically reverted

## 🚀 Deployment

### **Vercel (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### **Docker**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### **Traditional Server**
```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🧪 Development

### **Available Scripts**
```bash
# Development
npm run dev          # Start development server
npm run dev:turbo    # Start with Turbopack

# Building
npm run build        # Production build
npm run start        # Start production server

# Database
npm run db:push      # Push schema changes
npm run db:studio    # Open Drizzle Studio

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # TypeScript checking
```

### **Database Management**
```bash
# View/edit data
npm run db:studio

# Reset database
rm crypture.db
npm run db:push
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Development Guidelines**
- Follow TypeScript best practices
- Use shadcn/ui components when possible
- Write comprehensive error handling
- Add audit logging for state changes
- Maintain responsive design
- Test across different environments

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [shadcn/ui](https://ui.shadcn.com/) - UI component library
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [NextAuth.js](https://next-auth.js.org/) - Authentication
- [React Email](https://react.email/) - Email templates
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide](https://lucide.dev/) - Icons

## 📞 Support

For support, email [support@crypture.dev](mailto:support@crypture.dev) or open an issue on GitHub.

---

**Built with ❤️ using modern web technologies**