# Citation Generator & Manager
### Created by Liby

A Windows desktop app for generating and managing academic citations in **APA** and **ACM** formats, with BibTeX export for LaTeX/Overleaf.

![Windows](https://img.shields.io/badge/Platform-Windows%2010%2F11-blue)
![Version](https://img.shields.io/badge/Version-1.0.0-brightgreen)
![License](https://img.shields.io/badge/License-Free-orange)

---

## ⬇️ Download

Go to the **[Releases](../../releases)** section and download:

| File | Description |
|------|-------------|
| `Citation Generator Setup 1.0.0.exe` | Standard Windows installer |
| `CitationGenerator-Portable-1.0.0.exe` | Portable — no installation needed, just run it |

> See [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) for step-by-step setup instructions.

---

## Features

- **Citation Generation**: Create properly formatted citations from form inputs
- **Multiple Formats**: Support for APA 7th Edition and ACM citation styles
- **BibTeX Export**: Convert citations to BibTeX format for use in LaTeX/Overleaf
- **Source Types**: Journal articles, books, websites, and conference papers
- **Folder Organization**: Create folders to organize your citations by project
- **Export Options**: Export to PDF, Word (DOCX), or BibTeX files
- **Persistent Storage**: Citations are automatically saved locally
- **Copy to Clipboard**: One-click copy of formatted citations

## Installation

### From Source

1. **Prerequisites**: Install [Node.js](https://nodejs.org/) (v16 or later)

2. **Clone or download this folder**

3. **Install dependencies**:
   ```powershell
   cd "Citation Generator App"
   npm install
   ```

4. **Run the application**:
   ```powershell
   npm start
   ```

### Build Installer for Windows

To create Windows installers for distribution:

```powershell
# Build both installer and portable version
npm run build:all
```

Or build separately:
```powershell
# Standard installer only
npm run build

# Portable version only
npm run build:portable
```

The output files will be in the `dist` folder:
- `Citation Generator Setup 1.0.0.exe` - Standard installer
- `CitationGenerator-Portable-1.0.0.exe` - Portable version (no install needed)

### Sharing with Friends

After building, share these files from the `dist` folder:
1. **For permanent install:** `Citation Generator Setup 1.0.0.exe`
2. **For portable use:** `CitationGenerator-Portable-1.0.0.exe`

See [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) for detailed installation instructions.

## Usage

### Creating a Citation

1. Select the **Source Type** (Journal, Book, Website, or Conference)
2. Choose the **Citation Format** (APA or ACM)
3. Fill in the required fields:
   - Authors (one per line: Last Name, First Name)
   - Title
   - Year
   - Additional fields based on source type
4. Click **Generate Citation**
5. Preview the formatted citation and BibTeX output
6. Click **Copy to Clipboard** or **Add to List**

### Managing Citations

- **Add to Folder**: Click "Add to List" after generating a citation
- **Create Folder**: Click the + button in the sidebar
- **Switch Folders**: Click on any folder in the sidebar
- **Delete Citation**: Click the trash icon on any saved citation
- **Copy Citation**: Click the copy icon on any saved citation

### Exporting

- **Export PDF**: Export all citations in the current folder to PDF
- **Export DOC**: Export to Microsoft Word format
- **Export BibTeX**: Export all citations as a .bib file for LaTeX

## File Locations

- **Application Data**: `%APPDATA%/citation-generator/`
- **Citations Data**: `%APPDATA%/citation-generator/citations-data.json`

## Technologies Used

- Electron
- HTML5 / CSS3
- JavaScript (ES6+)
- PDFKit (PDF generation)
- docx (Word document generation)

## Credits

**Created by Liby**

## License

MIT License
