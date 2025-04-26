# Network Request Schema Generator

A browser extension tool that automatically generates [Zod](https://github.com/colinhacks/zod) and [Joi](https://github.com/hapijs/joi) schemas from network requests. This tool helps developers streamline their API integration process by automatically creating validation schemas based on observed network traffic, making it easier to validate API requests and responses.

## Features

- 🔍 Automatic schema generation from network requests
- ✨ Support for both Zod and Joi schemas
- 🎯 Smart type inference and validation rules
- 🌐 Browser extension integration
- ⚡ Real-time request monitoring
- 💾 Export schemas to your project
- 📝 Clean and readable schema output

## Installation

1. Clone the repository:
```bash
git clone [your-repository-url]
cd schema-generator
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the extension:
```bash
pnpm build
```

4. Load the extension in your browser:
   - Open Chrome/Edge and navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory from this project

## Development

To start the development server:

```bash
pnpm dev
```

The project uses the following tech stack:
- Preact for UI components
- TypeScript for type safety
- Vite for building and development
- Chrome Extension APIs for browser integration
- Zod and Joi for schema generation

## Project Structure

```
schema-generator/
├── src/
│   ├── popup/      # Extension popup UI
│   ├── background/ # Background service worker
│   └── assets/     # Static assets
├── dist/           # Build output
└── vite.config.ts  # Vite configuration
```

## Usage

1. Click the extension icon in your browser
2. Start making network requests on your target website
3. The extension will automatically capture and analyze the requests
4. Choose between Zod or Joi schema generation
5. Generated schemas will be displayed in the extension popup
6. Export the schemas to use in your project

### Example Generated Schema

```typescript
// Zod Schema Example
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  isActive: z.boolean()
});

// Joi Schema Example
const userSchema = Joi.object({
  id: Joi.number().required(),
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  isActive: Joi.boolean().required()
});
```

## Privacy Policy

This extension does not collect or transmit any personal data. All data processing happens locally in your browser. For more details, please see our [Privacy Policy](PRIVACY.md).

## Contributing

Contributions are welcome!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and feature requests, please [open an issue](your-repository-url/issues) on GitHub. 