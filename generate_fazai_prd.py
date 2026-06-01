#!/usr/bin/env python3
"""
FAZAI PRD & Architecture Flow - PDF Generator
Uses ReportLab for body + html2poster.js for cover + pypdf for merge
"""

import os, sys, hashlib, subprocess
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, CondPageBreak, Flowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus import SimpleDocTemplate
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Constants ──────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN = 72  # 1 inch
OUTPUT_DIR = "/home/z/my-project/download"
BODY_PDF = os.path.join(OUTPUT_DIR, "fazai_body.pdf")
COVER_HTML = os.path.join(OUTPUT_DIR, "fazai_cover.html")
COVER_PDF = os.path.join(OUTPUT_DIR, "fazai_cover.pdf")
FINAL_PDF = os.path.join(OUTPUT_DIR, "FAZAI-PRD-Architecture-Flow.pdf")
PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"

# ── Palette (user-specified) ──────────────────────────────────────────────
ACCENT       = colors.HexColor('#c82b45')
TEXT_PRIMARY  = colors.HexColor('#1b1a18')
TEXT_MUTED    = colors.HexColor('#7a766f')
BG_SURFACE   = colors.HexColor('#e5e3df')
BG_PAGE      = colors.HexColor('#edecea')
TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# ── Font Registration ─────────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Times New Roman Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ── Available width ───────────────────────────────────────────────────────
AVAIL_W = PAGE_W - 2 * MARGIN  # ~451pt

# ── Styles ────────────────────────────────────────────────────────────────
FONT = 'Times New Roman'

style_title = ParagraphStyle(
    name='DocTitle', fontName=FONT, fontSize=28, leading=34,
    textColor=ACCENT, alignment=TA_LEFT, spaceAfter=12
)

style_h1 = ParagraphStyle(
    name='H1', fontName=FONT, fontSize=20, leading=26,
    textColor=ACCENT, spaceBefore=24, spaceAfter=10
)

style_h2 = ParagraphStyle(
    name='H2', fontName=FONT, fontSize=15, leading=20,
    textColor=TEXT_PRIMARY, spaceBefore=18, spaceAfter=8
)

style_body = ParagraphStyle(
    name='Body', fontName=FONT, fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=8
)

style_body_left = ParagraphStyle(
    name='BodyLeft', fontName=FONT, fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=8
)

style_table_header = ParagraphStyle(
    name='TH', fontName=FONT, fontSize=9.5, leading=13,
    textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER
)

style_table_cell = ParagraphStyle(
    name='TC', fontName=FONT, fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER
)

style_table_cell_left = ParagraphStyle(
    name='TCL', fontName=FONT, fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT
)

style_table_cell_justify = ParagraphStyle(
    name='TCJ', fontName=FONT, fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY
)

style_caption = ParagraphStyle(
    name='Caption', fontName=FONT, fontSize=9, leading=12,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6
)

style_toc_h1 = ParagraphStyle(
    name='TOCH1', fontName=FONT, fontSize=13, leading=22,
    leftIndent=20, textColor=TEXT_PRIMARY
)

style_toc_h2 = ParagraphStyle(
    name='TOCH2', fontName=FONT, fontSize=11, leading=18,
    leftIndent=40, textColor=TEXT_MUTED
)

# ── TocDocTemplate ────────────────────────────────────────────────────────
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ── Helper: add heading with bookmark ─────────────────────────────────────
def add_heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

# ── Helper: safe keep together ────────────────────────────────────────────
MAX_KEEP_HEIGHT = PAGE_H * 0.4

def safe_keep_together(elements):
    total_h = 0
    for el in elements:
        w, h = el.wrap(AVAIL_W, PAGE_H)
        total_h += h
    if total_h <= MAX_KEEP_HEIGHT:
        return [KeepTogether(elements)]
    elif len(elements) >= 2:
        return [KeepTogether(elements[:2])] + list(elements[2:])
    else:
        return list(elements)

# ── Helper: build a standard table ────────────────────────────────────────
def build_table(headers, rows, col_ratios, caption_text=None):
    """Build a styled table with header + rows, centered."""
    col_widths = [r * AVAIL_W for r in col_ratios]

    data = []
    # Header row
    header_row = [Paragraph('<b>%s</b>' % h, style_table_header) for h in headers]
    data.append(header_row)

    # Body rows
    for row in rows:
        data_row = []
        for i, cell in enumerate(row):
            if isinstance(cell, Paragraph):
                data_row.append(cell)
            else:
                # Use left-aligned for wider columns, center for narrow
                if col_ratios[i] >= 0.30:
                    data_row.append(Paragraph(str(cell), style_table_cell_left))
                else:
                    data_row.append(Paragraph(str(cell), style_table_cell))
        data.append(data_row)

    tbl = Table(data, colWidths=col_widths, hAlign='CENTER')

    # Build alternating row styles
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))

    tbl.setStyle(TableStyle(style_cmds))

    elements = [Spacer(1, 18), tbl]
    if caption_text:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(caption_text, style_caption))
    elements.append(Spacer(1, 18))
    return elements

# ── Helper: horizontal rule ───────────────────────────────────────────────
class HRule(Flowable):
    def __init__(self, width, thickness=1, color=ACCENT, opacity=0.3):
        Flowable.__init__(self)
        self.width = width
        self.thickness = thickness
        self.color = color
        self.opacity = opacity
        self.height = thickness + 4
    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 2, self.width, 2)

# ── Page template callbacks ───────────────────────────────────────────────
def on_page(canvas, doc):
    """Footer with page number."""
    canvas.saveState()
    canvas.setFont(FONT, 9)
    canvas.setFillColor(TEXT_MUTED)
    page_num = canvas.getPageNumber()
    canvas.drawCentredString(PAGE_W / 2, MARGIN / 2, str(page_num))
    # thin top rule
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, PAGE_H - MARGIN + 12, PAGE_W - MARGIN, PAGE_H - MARGIN + 12)
    canvas.restoreState()

def on_page_first(canvas, doc):
    """First page - no page number (cover is separate)."""
    canvas.saveState()
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, PAGE_H - MARGIN + 12, PAGE_W - MARGIN, PAGE_H - MARGIN + 12)
    canvas.restoreState()


# ══════════════════════════════════════════════════════════════════════════
# COVER HTML (Template 05: Floating Diagonal)
# ══════════════════════════════════════════════════════════════════════════
COVER_HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=794">
<style>
  @page { size: 794px 1123px; margin: 0; }
  html, body { margin: 0; padding: 0; width: 794px; height: 1123px; background: #ffffff; }
  .cover { position: relative; width: 794px; height: 1123px; overflow: hidden; font-family: 'Times New Roman', Georgia, serif; }

  /* Layer 1: Background */
  .bg-layer { position: absolute; inset: 0; z-index: 1; overflow: hidden; }

  /* Layer 2: Structure */
  .struct-layer { position: absolute; inset: 0; z-index: 2; }
  .binding-line {
    position: absolute; left: 63px; top: 56px; width: 0; height: 1011px;
    border-left: 1px dashed rgba(200,43,69,0.25);
  }

  /* Layer 3: Content */
  .content-layer { position: absolute; inset: 0; z-index: 3; }

  /* Upper-left group */
  .upper-group { position: absolute; left: 119px; top: 225px; }
  .kicker {
    font-size: 16px; font-weight: 400; letter-spacing: 3px;
    color: #7a766f; opacity: 0.7; margin-bottom: 20px;
    text-transform: uppercase;
  }
  .hero-title {
    font-size: 80px; font-weight: 900; color: #c82b45;
    line-height: 1.1; letter-spacing: 2px;
  }

  /* Lower-right group */
  .lower-group { position: absolute; left: 357px; top: 675px; }
  .accent-vline {
    position: absolute; left: -16px; top: 0; width: 0; height: 180px;
    border-left: 3px solid #c82b45;
  }
  .summary {
    font-size: 17px; font-weight: 400; color: #1b1a18;
    line-height: 1.6; opacity: 0.85; max-width: 360px; margin-bottom: 30px;
  }
  .meta {
    font-size: 20px; font-weight: 400; color: #1b1a18;
    line-height: 2.0; opacity: 0.85;
  }
  .footer-line {
    font-size: 16px; font-weight: 400; color: #7a766f;
    opacity: 0.6; letter-spacing: 1px; margin-top: 24px;
  }
</style>
</head>
<body>
<div class="cover">
  <div class="bg-layer"></div>
  <div class="struct-layer">
    <div class="binding-line"></div>
  </div>
  <div class="content-layer">
    <div class="upper-group">
      <div class="kicker">PRODUCT REQUIREMENTS DOCUMENT</div>
      <div class="hero-title">FAZAI</div>
    </div>
    <div class="lower-group">
      <div class="accent-vline"></div>
      <div class="summary">
        A comprehensive product requirements document and architecture flow for FAZAI, a personal cash-basis accounting Progressive Web Application designed for simplicity, offline capability, and AI-powered financial management.
      </div>
      <div class="meta">
        Product Requirements Document<br>
        &amp; Architecture Flow<br>
        June 2026 &middot; v0.4.0
      </div>
      <div class="footer-line">CONFIDENTIAL</div>
    </div>
  </div>
</div>
</body>
</html>
"""


# ══════════════════════════════════════════════════════════════════════════
# BUILD BODY PDF
# ══════════════════════════════════════════════════════════════════════════
def build_body():
    doc = TocDocTemplate(
        BODY_PDF, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=MARGIN,
        title="FAZAI PRD & Architecture Flow",
        author="Z.ai",
        creator="Z.ai"
    )

    story = []

    # ── Table of Contents ─────────────────────────────────────────────────
    toc = TableOfContents()
    toc.levelStyles = [style_toc_h1, style_toc_h2]

    story.append(Paragraph('<b>Table of Contents</b>', style_title))
    story.append(Spacer(1, 12))
    story.append(toc)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # PART I: PRODUCT REQUIREMENTS DOCUMENT
    # ══════════════════════════════════════════════════════════════════════
    story.append(add_heading('<b>Part I: Product Requirements Document</b>', style_h1, level=0))
    story.append(HRule(AVAIL_W, 2, ACCENT, 1.0))
    story.append(Spacer(1, 12))

    # ── Section 1: Product Overview ──────────────────────────────────────
    story.append(add_heading('<b>1. Product Overview</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    overview_text = (
        "FAZAI is a personal cash-basis accounting Progressive Web Application (PWA) designed for "
        "individuals and small business owners who need simple, double-entry bookkeeping without the "
        "complexity of enterprise accounting software. The application follows cash-basis accounting "
        "principles with full double-entry ledger support, enabling accurate financial tracking through "
        "debit-credit journal entries. Every transaction recorded in FAZAI maintains the fundamental "
        "accounting equation where total debits equal total credits, ensuring that financial statements "
        "are always balanced and audit-ready."
    )
    story.append(Paragraph(overview_text, style_body))

    overview_text2 = (
        'The core philosophy behind FAZAI is captured in the statement: "Accounting should be as simple '
        'as tapping your phone." This mobile-first, offline-capable application works without internet '
        'connectivity for all core functions, making it ideal for users in areas with unreliable '
        'connectivity or those who simply prefer a fast, local-first experience. The application stores '
        'all financial data directly in the browser using IndexedDB, eliminating the need for server-side '
        'infrastructure and ensuring that sensitive financial information remains on the user\'s device.'
    )
    story.append(Paragraph(overview_text2, style_body))

    overview_text3 = (
        "The target users for FAZAI span four primary categories: (1) Individuals tracking personal "
        "income and expenses who want a straightforward tool to understand their cash flow; (2) Freelancers "
        "managing income from multiple clients who need to track expenses by category and project; "
        "(3) Small business owners needing basic bookkeeping capabilities including financial reporting "
        "and double-entry ledger management; and (4) Accounting students learning double-entry principles "
        "who benefit from a hands-on, interactive learning environment."
    )
    story.append(Paragraph(overview_text3, style_body))

    overview_text4 = (
        "FAZAI's key differentiators in the personal accounting space include: an offline-first PWA "
        "architecture that ensures core functionality works without network access; an AI-powered "
        "transaction assistant that enables natural-language financial queries and transaction creation; "
        "comprehensive multi-language support covering English, Bahasa Indonesia, and Chinese; PIN-based "
        "quick access for secure yet convenient authentication; and zero server dependency for core "
        "features, meaning the application can function entirely on a single device with no recurring "
        "infrastructure costs."
    )
    story.append(Paragraph(overview_text4, style_body))

    # ── Section 2: User Personas ─────────────────────────────────────────
    story.append(add_heading('<b>2. User Personas</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    persona_headers = ['Persona', 'Role', 'Tech Level', 'Primary Need']
    persona_rows = [
        ['Rina', 'Individual', 'Basic', 'Track daily spending and savings'],
        ['Budi', 'Freelancer', 'Intermediate', 'Manage income from multiple clients, track expenses by category'],
        ['Admin Sari', 'Small Business', 'Advanced', 'Full double-entry bookkeeping, financial reporting, team access'],
    ]
    story.extend(build_table(persona_headers, persona_rows, [0.12, 0.14, 0.14, 0.60],
                             'Table 1: User Personas Overview'))

    # Rina
    story.append(add_heading('<b>2.1 Rina - Individual</b>', style_h2, level=1))
    rina_text = (
        "Rina is a 28-year-old office worker who wants to understand where her money goes each month. "
        "She has tried spreadsheet-based tracking but finds it tedious to maintain. Her primary goal is "
        "to see a simple dashboard showing her income versus expenses at a glance, without needing to "
        "understand accounting terminology. She wants to quickly record a cup of coffee or a grocery run "
        "in under 5 seconds. Her pain points include: complex accounting apps that overwhelm her with "
        "features she does not need, apps that require internet connectivity (she commutes through areas "
        "with poor signal), and the lack of Bahasa Indonesia localization in most financial apps. FAZAI "
        "addresses Rina's needs by providing a one-tap expense entry on the dashboard, an offline-first "
        "architecture that works during her commute, full Bahasa Indonesia support, and a clean dashboard "
        "that shows today's income and expense totals without requiring any accounting knowledge."
    )
    story.append(Paragraph(rina_text, style_body))

    # Budi
    story.append(add_heading('<b>2.2 Budi - Freelancer</b>', style_h2, level=1))
    budi_text = (
        "Budi is a 35-year-old freelance graphic designer who works with 5-8 clients simultaneously. "
        "He needs to track income per client and categorize business expenses for tax purposes. His "
        "primary goals are to know which clients have paid, how much he has earned this month versus "
        "last month, and to generate simple reports for his tax accountant. His pain points include: "
        "losing track of which payments correspond to which invoices, mixing personal and business "
        "expenses in one account, and spending too much time on bookkeeping when he should be designing. "
        "FAZAI helps Budi by allowing him to tag transactions with counterparties, providing monthly "
        "Profit and Loss reports for his tax accountant, offering category-based expense tracking that "
        "separates business from personal spending, and enabling the AI assistant to answer queries like "
        "'How much did I earn from Client X this month?' without manual report generation."
    )
    story.append(Paragraph(budi_text, style_body))

    # Admin Sari
    story.append(add_heading('<b>2.3 Admin Sari - Small Business</b>', style_h2, level=1))
    sari_text = (
        "Sari is a 42-year-old owner of a small retail shop with 3 employees. She needs proper "
        "double-entry bookkeeping to satisfy her accountant and wants to generate financial statements "
        "including Balance Sheets and Cash Flow reports. Her primary goals are to maintain accurate "
        "financial records that her accountant can audit, control which employees can access sensitive "
        "financial data, and export reports in PDF and Excel formats for her bank and tax filings. Her "
        "pain points include: enterprise accounting software being too expensive and complex for her "
        "needs, difficulty controlling employee access to financial data, and the inability of simple "
        "expense trackers to produce proper financial statements. FAZAI addresses Sari's requirements "
        "through its admin/user role system that restricts report access and custom journal entries to "
        "administrators, full double-entry ledger with Trial Balance and Balance Sheet reports, PDF and "
        "XLSX export capabilities for all financial reports, and a custom journal entry feature that "
        "allows her accountant to make adjusting entries directly in the application."
    )
    story.append(Paragraph(sari_text, style_body))

    # ── Section 3: Feature Requirements ──────────────────────────────────
    story.append(add_heading('<b>3. Feature Requirements</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    feature_headers = ['ID', 'Feature', 'Priority', 'Status', 'Description']
    feature_data = [
        ['F01', 'PIN Authentication', 'Must', 'Done', '6-digit PIN login with admin/user roles'],
        ['F02', 'Income Recording', 'Must', 'Done', 'Quick income entry with account selection'],
        ['F03', 'Expense Recording', 'Must', 'Done', 'Quick expense entry with category selection'],
        ['F04', 'Transaction History', 'Must', 'Done', 'Searchable, filterable transaction list'],
        ['F05', 'Dashboard', 'Must', 'Done', 'Balance overview, today\'s income/expense, recent transactions'],
        ['F06', 'AI Assistant', 'Should', 'Done', 'Chat-based transaction creation, financial queries, insights'],
        ['F07', 'Trial Balance', 'Must', 'Done', 'Point-in-time debit/credit balance report'],
        ['F08', 'Balance Sheet', 'Must', 'Done', 'Assets, liabilities, equity as-of report'],
        ['F09', 'Profit & Loss', 'Must', 'Done', 'Period-based income/expense/net profit report'],
        ['F10', 'Cash Flow', 'Must', 'Done', 'Period-based inflow/outflow/net change report'],
        ['F11', 'Ledger Report', 'Must', 'Done', 'Per-account transaction detail with running balance'],
        ['F12', 'PDF Export', 'Should', 'Done', 'Report export to PDF with branded header'],
        ['F13', 'XLSX Export', 'Should', 'Done', 'Report export to Excel spreadsheet'],
        ['F14', 'Custom Journal Entry', 'Must', 'Done', 'Admin multi-row debit/credit entry'],
        ['F15', 'Account Management', 'Must', 'Done', 'CRUD for chart of accounts with toggle'],
        ['F16', 'User Management', 'Must', 'Done', 'Admin CRUD for users with PIN/role'],
        ['F17', 'Backup & Restore', 'Must', 'Done', 'JSON export/import, factory reset'],
        ['F18', 'Opening Balance', 'Should', 'Done', 'Set initial account balances'],
        ['F19', 'Multi-language', 'Should', 'Done', 'English, Bahasa Indonesia, Chinese'],
        ['F20', 'Dark Mode', 'Should', 'Done', 'System-aware theme switching'],
        ['F21', 'PWA Install', 'Must', 'Done', 'Add-to-homescreen capable'],
        ['F22', 'Offline Core', 'Must', 'Partial', 'Data works offline, but no Service Worker for app shell'],
        ['F23', 'Monthly Summaries', 'Must', 'Done', 'Optimized balance calculation via summary table'],
        ['F24', 'Data Archive', 'Should', 'Done', 'Auto-archive transactions older than 6 months'],
        ['F25', 'AI Account Suggest', 'Could', 'Done', 'Keyword-based account suggestion for entries'],
        ['F26', 'AI Delete Action', 'Should', 'Done', 'Delete transactions via AI chat'],
        ['F27', 'User Guide', 'Should', 'Done', 'In-app help with accordion sections'],
        ['F28', 'Admin Reports Gate', 'Should', 'Planned', 'Restrict report access to admin role'],
        ['F29', 'Account Balance Field', 'Should', 'Planned', 'Show current balance on account cards'],
        ['F30', 'Custom Txn Form Redesign', 'Could', 'Planned', 'Modern multi-row entry UX overhaul'],
        ['F31', 'FAZAI Logo', 'Must', 'Planned', 'Use FAZAI.jpg as app logo'],
        ['F32', 'Factory Reset', 'Must', 'Done', 'Full database reset with challenge code'],
    ]

    # Build feature table with Paragraph cells for wrapping
    feat_header_row = [Paragraph('<b>%s</b>' % h, style_table_header) for h in feature_headers]
    feat_data = [feat_header_row]
    for row in feature_data:
        feat_data.append([
            Paragraph(row[0], style_table_cell),
            Paragraph(row[1], style_table_cell_left),
            Paragraph(row[2], style_table_cell),
            Paragraph(row[3], style_table_cell),
            Paragraph(row[4], style_table_cell_left),
        ])

    feat_col_widths = [0.06, 0.18, 0.08, 0.08, 0.60]
    feat_col_pts = [r * AVAIL_W for r in feat_col_widths]
    feat_tbl = Table(feat_data, colWidths=feat_col_pts, hAlign='CENTER', repeatRows=1)

    feat_style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(feat_data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        feat_style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    feat_tbl.setStyle(TableStyle(feat_style_cmds))

    story.append(Spacer(1, 18))
    story.append(feat_tbl)
    story.append(Spacer(1, 6))
    story.append(Paragraph('Table 2: Feature Requirements Matrix', style_caption))
    story.append(Spacer(1, 18))

    # Feature prioritization text
    prio_text = (
        "Feature prioritization in FAZAI follows the MoSCoW method, categorizing each feature as Must-have, "
        "Should-have, or Could-have. Must-have features represent the minimum viable product: without PIN "
        "authentication, income/expense recording, transaction history, and the dashboard, the application "
        "cannot fulfill its core purpose as an accounting tool. Should-have features enhance the user "
        "experience significantly but are not blocking for initial release; these include the AI assistant, "
        "PDF/XLSX export, multi-language support, and dark mode. Could-have features are desirable "
        "enhancements that would improve the product but can be deferred without impacting core "
        "functionality, such as AI account suggestions and the custom transaction form redesign."
    )
    story.append(Paragraph(prio_text, style_body))

    prio_text2 = (
        "The current status reflects a mature MVP: 27 of 32 features are marked as Done, with only 3 "
        "features remaining in Planned status and 1 feature (Offline Core) partially implemented. The "
        "upcoming roadmap focuses on three key areas. First, completing the PWA offline experience by "
        "implementing a Service Worker for the application shell, enabling full offline access including "
        "UI loading without network (F22). Second, strengthening the admin role model by gating report "
        "access behind admin authentication (F28) and displaying account balances directly on account "
        "cards (F29). Third, visual identity and UX improvements including the FAZAI logo integration "
        "(F31) and a redesigned custom transaction form that simplifies multi-row debit/credit entry "
        "(F30). These planned features target the v0.5.0 release milestone."
    )
    story.append(Paragraph(prio_text2, style_body))

    # ── Section 4: Non-Functional Requirements ───────────────────────────
    story.append(add_heading('<b>4. Non-Functional Requirements</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    nfr_headers = ['Category', 'Requirement', 'Target']
    nfr_rows = [
        ['Performance', 'Initial load time', '< 3 seconds on 4G'],
        ['Performance', 'Report generation', '< 2 seconds for 1000 transactions'],
        ['Performance', 'AI response time', '< 5 seconds'],
        ['Reliability', 'Data integrity', 'Zero data loss on browser crash'],
        ['Reliability', 'Offline capability', 'Core CRUD works without network'],
        ['Security', 'PIN authentication', 'Minimum 6 digits, no plaintext storage'],
        ['Security', 'Data encryption', 'IndexedDB data encrypted at rest'],
        ['Security', 'API access', 'Authenticated endpoints only'],
        ['Usability', 'Mobile-first', 'All screens optimized for 375px width'],
        ['Usability', 'Accessibility', 'WCAG 2.1 Level AA target'],
        ['Compatibility', 'Browser support', 'Chrome, Safari, Firefox, Edge (latest 2 versions)'],
        ['Compatibility', 'PWA install', 'Android Chrome, iOS Safari'],
        ['Localization', 'Languages', 'English, Bahasa Indonesia, Chinese (Simplified)'],
        ['Maintainability', 'Test coverage', '> 80% on core engine, > 60% overall'],
        ['Maintainability', 'TypeScript strict', 'strict mode enabled, zero any types'],
    ]
    story.extend(build_table(nfr_headers, nfr_rows, [0.18, 0.30, 0.52],
                             'Table 3: Non-Functional Requirements'))

    nfr_expansion = (
        "Among the non-functional requirements, three categories demand particular attention due to their "
        "impact on user trust and application viability. Performance is critical for user adoption: the "
        "initial load target of under 3 seconds on 4G ensures that mobile users, who represent the "
        "primary audience, are not deterred by sluggish startup. Report generation under 2 seconds for "
        "1000 transactions is achieved through the pre-calculated monthly summary strategy, which avoids "
        "scanning the entire transaction history for each report. Reliability requirements are equally "
        "paramount since the application stores financial data locally in IndexedDB. Zero data loss on "
        "browser crash is ensured through Dexie.js transaction semantics and the backup/restore feature. "
        "Security, while currently minimal with plaintext PIN storage, represents the highest-risk NFR: "
        "the planned migration to hashed PINs and encrypted IndexedDB storage is essential before any "
        "multi-user production deployment. The current security posture is acceptable only for personal "
        "single-device use scenarios."
    )
    story.append(Paragraph(nfr_expansion, style_body))

    # ── Section 5: Data Model ────────────────────────────────────────────
    story.append(add_heading('<b>5. Data Model</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    dm_intro = (
        "The FAZAI data model consists of six core entities stored in IndexedDB via Dexie.js. The model "
        "follows a normalized relational structure adapted for client-side document storage. Each entity "
        "is described below with its fields, types, and relationships."
    )
    story.append(Paragraph(dm_intro, style_body))

    # User entity
    story.append(add_heading('<b>5.1 User</b>', style_h2, level=1))
    user_headers = ['Field', 'Type', 'Description']
    user_rows = [
        ['id', 'string (PK)', 'Auto-generated unique identifier'],
        ['pin', 'string', '6-digit numeric PIN for authentication'],
        ['name', 'string', 'Display name of the user'],
        ['role', 'admin | user', 'Role determining access permissions'],
        ['isSystem', 'boolean', 'Whether this is a system-created user'],
        ['createdAt', 'Date', 'Timestamp of user creation'],
    ]
    story.extend(build_table(user_headers, user_rows, [0.18, 0.22, 0.60],
                             'Table 4: User Entity Fields'))

    # Account entity
    story.append(add_heading('<b>5.2 Account</b>', style_h2, level=1))
    account_headers = ['Field', 'Type', 'Description']
    account_rows = [
        ['id', 'string (PK)', 'Auto-generated unique identifier'],
        ['code', 'string', 'Account code (e.g., 1-1000, 5-1000)'],
        ['name', 'string', 'Account name in English'],
        ['nameId', 'string?', 'Account name in Bahasa Indonesia (optional)'],
        ['nameZh', 'string?', 'Account name in Chinese (optional)'],
        ['type', 'asset | cashBank | liability | equity | income | expense', 'Account classification type'],
        ['parentId', 'string? (FK)', 'Parent account ID for hierarchical structure'],
        ['isSystem', 'boolean', 'Whether this is a system-created account'],
        ['isActive', 'boolean', 'Whether the account is currently active'],
        ['createdAt', 'Date', 'Timestamp of account creation'],
    ]
    story.extend(build_table(account_headers, account_rows, [0.15, 0.30, 0.55],
                             'Table 5: Account Entity Fields'))

    # Transaction entity
    story.append(add_heading('<b>5.3 Transaction</b>', style_h2, level=1))
    txn_headers = ['Field', 'Type', 'Description']
    txn_rows = [
        ['id', 'string (PK)', 'Auto-generated unique identifier'],
        ['date', 'Date', 'Transaction date'],
        ['description', 'string', 'Human-readable description'],
        ['counterparty', 'string', 'Counterparty name (e.g., client, vendor)'],
        ['type', 'income | expense | custom', 'Transaction classification'],
        ['createdBy', 'string (FK)', 'Reference to User who created this transaction'],
        ['createdAt', 'Date', 'Timestamp of creation'],
        ['entries', 'Entry[]', 'Array of debit/credit entry objects'],
    ]
    story.extend(build_table(txn_headers, txn_rows, [0.18, 0.25, 0.57],
                             'Table 6: Transaction Entity Fields'))

    # Entry entity
    story.append(add_heading('<b>5.4 Entry</b>', style_h2, level=1))
    entry_headers = ['Field', 'Type', 'Description']
    entry_rows = [
        ['id', 'string (PK)', 'Auto-generated unique identifier'],
        ['accountId', 'string (FK)', 'Reference to Account'],
        ['debit', 'number', 'Debit amount (0 if credit entry)'],
        ['credit', 'number', 'Credit amount (0 if debit entry)'],
    ]
    story.extend(build_table(entry_headers, entry_rows, [0.18, 0.22, 0.60],
                             'Table 7: Entry Entity Fields'))

    # AccountMonthlySummary entity
    story.append(add_heading('<b>5.5 AccountMonthlySummary</b>', style_h2, level=1))
    summary_headers = ['Field', 'Type', 'Description']
    summary_rows = [
        ['id', 'string (PK)', 'Auto-generated unique identifier'],
        ['accountId', 'string (FK)', 'Reference to Account'],
        ['year', 'number', 'Calendar year (e.g., 2026)'],
        ['month', 'number (0-11)', 'Month index (0=January, 11=December)'],
        ['totalDebit', 'number', 'Sum of all debits for this account/month'],
        ['totalCredit', 'number', 'Sum of all credits for this account/month'],
        ['lastCalculated', 'Date', 'Timestamp of last calculation'],
    ]
    story.extend(build_table(summary_headers, summary_rows, [0.18, 0.22, 0.60],
                             'Table 8: AccountMonthlySummary Entity Fields'))

    # ArchivedTransaction entity
    story.append(add_heading('<b>5.6 ArchivedTransaction</b>', style_h2, level=1))
    arch_headers = ['Field', 'Type', 'Description']
    arch_rows = [
        ['(all Transaction fields)', 'various', 'Inherits all fields from Transaction entity'],
        ['archivedAt', 'Date', 'Timestamp when the transaction was archived'],
    ]
    story.extend(build_table(arch_headers, arch_rows, [0.30, 0.20, 0.50],
                             'Table 9: ArchivedTransaction Entity Fields'))

    # Default Chart of Accounts
    story.append(add_heading('<b>5.7 Default Chart of Accounts</b>', style_h2, level=1))
    coa_text = (
        "FAZAI ships with a pre-configured chart of accounts following a standard numerical coding system. "
        "The default structure provides a comprehensive starting point for personal and small business "
        "accounting:"
    )
    story.append(Paragraph(coa_text, style_body))

    coa_headers = ['Code', 'Account Name', 'Type']
    coa_rows = [
        ['1-0000', 'Assets', 'asset'],
        ['1-1000', 'Cash & Bank', 'cashBank'],
        ['1-1100', 'Cash on Hand', 'cashBank'],
        ['1-1200', 'Bank Account', 'cashBank'],
        ['2-0000', 'Liabilities', 'liability'],
        ['3-0000', 'Equity', 'equity'],
        ['3-1000', 'Opening Balance', 'equity'],
        ['4-0000', 'Income', 'income'],
        ['4-1000', 'Salary', 'income'],
        ['4-2000', 'Freelance', 'income'],
        ['4-3000', 'Sales', 'income'],
        ['4-4000', 'Interest Income', 'income'],
        ['4-9000', 'Other Income', 'income'],
        ['5-0000', 'Expenses', 'expense'],
        ['5-1000', 'Food & Beverages', 'expense'],
        ['5-2000', 'Transportation', 'expense'],
        ['5-9000', 'Other Expense', 'expense'],
    ]
    story.extend(build_table(coa_headers, coa_rows, [0.15, 0.45, 0.40],
                             'Table 10: Default Chart of Accounts'))

    # ── Section 6: Business Rules ────────────────────────────────────────
    story.append(add_heading('<b>6. Business Rules</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    br_text1 = (
        "<b>Double-Entry Rule:</b> Every transaction in FAZAI must have balanced debits and credits. "
        "The sum of all debit amounts must equal the sum of all credit amounts for each transaction. "
        "This is enforced at the application layer before any transaction is persisted to IndexedDB. "
        "For income and expense quick-entry transactions, the system automatically creates the "
        "balancing entry against the appropriate Cash/Bank account."
    )
    story.append(Paragraph(br_text1, style_body))

    br_text2 = (
        "<b>Cash-Basis Recognition:</b> FAZAI follows cash-basis accounting principles where income "
        "is recognized when received (cash inflow) and expenses are recognized when paid (cash outflow). "
        "This contrasts with accrual accounting, which recognizes transactions when they are earned or "
        "incurred regardless of cash movement. The cash-basis approach simplifies the accounting model "
        "for FAZAI's target users who typically do not manage accounts receivable or payable."
    )
    story.append(Paragraph(br_text2, style_body))

    br_text3 = (
        "<b>Account Type Normal Balances:</b> Asset and CashBank accounts are debit-normal, meaning "
        "a debit entry increases their balance and a credit decreases it. Income accounts are "
        "credit-normal (credit increases balance). Expense accounts are debit-normal (debit increases "
        "balance). Liability and Equity accounts are credit-normal (credit increases balance). This "
        "classification determines how the ledger engine calculates running balances and how the "
        "Trial Balance, Balance Sheet, and Profit and Loss reports aggregate figures."
    )
    story.append(Paragraph(br_text3, style_body))

    br_text4 = (
        "<b>Monthly Summary Strategy:</b> Past months use pre-calculated AccountMonthlySummary records "
        "for fast report generation, while the current month uses live transaction scanning (Month-to-Date). "
        "This hybrid approach balances accuracy for the current period with query performance for "
        "historical data. The summary rollover process runs at application startup."
    )
    story.append(Paragraph(br_text4, style_body))

    br_text5 = (
        "<b>Archive Policy:</b> Transactions older than 6 months are automatically archived at startup, "
        "moving them from the active Transaction table to the ArchivedTransaction table. Archived "
        "transactions are excluded from routine queries but remain accessible for historical reports. "
        "This policy keeps the active dataset small and performant."
    )
    story.append(Paragraph(br_text5, style_body))

    br_text6 = (
        "<b>Opening Balances:</b> Initial account balances are created as custom transactions against "
        "the Opening Balance equity account (3-1000). This ensures that the double-entry equation "
        "remains balanced from the very first transaction and that opening balances appear correctly "
        "on the Balance Sheet."
    )
    story.append(Paragraph(br_text6, style_body))

    br_text7 = (
        "<b>PIN Rules and Role Separation:</b> PINs are currently 6-digit numeric codes with no "
        "complexity requirements (a minimum complexity check is planned for a future release). The "
        "admin role has access to custom journal entries, account and user management, and all reports. "
        "The user role can only record income/expense transactions and view the history and dashboard. "
        "This separation ensures that only authorized personnel can modify the chart of accounts or "
        "create adjusting entries."
    )
    story.append(Paragraph(br_text7, style_body))

    # ══════════════════════════════════════════════════════════════════════
    # PART II: ARCHITECTURE FLOW
    # ══════════════════════════════════════════════════════════════════════
    story.append(add_heading('<b>Part II: Architecture Flow</b>', style_h1, level=0))
    story.append(HRule(AVAIL_W, 2, ACCENT, 1.0))
    story.append(Spacer(1, 12))

    # ── Section 7: System Architecture Overview ──────────────────────────
    story.append(add_heading('<b>7. System Architecture Overview</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    arch_text1 = (
        "FAZAI follows a client-heavy, single-page application architecture where the browser serves as "
        "both the presentation layer and the data persistence layer. Unlike traditional web applications "
        "that rely on a backend server for data storage and business logic, FAZAI executes virtually all "
        "operations client-side, with the server playing only a minimal role in AI feature processing."
    )
    story.append(Paragraph(arch_text1, style_body))

    arch_text2 = (
        "The entire application is a single Next.js page (page.tsx) that uses Zustand state to simulate "
        "client-side routing. The Next.js App Router is effectively bypassed: there are no dynamic routes, "
        "no server components, and no API middleware beyond the three AI endpoints. Navigation between "
        "screens (Dashboard, History, Reports, Settings, Admin Panel) is controlled entirely by the "
        "app-store's currentPage state variable, which determines which component subtree renders. This "
        "architectural decision simplifies deployment and eliminates the need for server-side rendering, "
        "but it means that the URL never changes during navigation and browser back/forward buttons do "
        "not work as expected."
    )
    story.append(Paragraph(arch_text2, style_body))

    arch_text3 = (
        "Data persistence is entirely client-side via Dexie.js, a thin wrapper around the browser's "
        "IndexedDB API. There is no server-side database: the Prisma schema and db.ts file present in "
        "the project are unused remnants from the initial project scaffold. All financial data, user "
        "credentials, and application state reside in the browser's IndexedDB, which persists across "
        "page reloads and browser restarts but is lost if the user clears browser data."
    )
    story.append(Paragraph(arch_text3, style_body))

    arch_text4 = (
        "The only server-side functionality consists of three API routes for AI features: "
        "/api/ai/chat (LLM conversation endpoint), /api/ai/context (data formatting for LLM context), "
        "and /api/ai/suggest (account keyword matching for transaction suggestions). These routes use "
        "the z-ai-web-dev-sdk to communicate with a cloud-based large language model. This architecture "
        "was chosen for its simplicity, zero infrastructure cost, and offline capability. The trade-offs "
        "are significant: no multi-device sync, no server-side data validation, limited security, and "
        "complete data loss if the user clears their browser storage without a backup."
    )
    story.append(Paragraph(arch_text4, style_body))

    # ── Section 8: Component Architecture ────────────────────────────────
    story.append(add_heading('<b>8. Component Architecture</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    comp_headers = ['Component', 'Type', 'Responsibility', 'Key Dependencies']
    comp_rows = [
        ['PinLogin', 'Page', 'Authentication screen', 'fazai-db, auth-store'],
        ['Dashboard', 'Page', 'Balance overview, quick actions', 'ledger-engine, auth-store'],
        ['TransactionForm', 'Page', 'Income/expense entry', 'ledger-engine, AI suggest API'],
        ['History', 'Page', 'Transaction search/list', 'fazai-db'],
        ['Settings', 'Page', 'User preferences', 'auth-store, fazai-db'],
        ['Reports', 'Page', 'Report type selector', 'app-store'],
        ['ReportViewer', 'Page', 'Report display/export', 'ledger-engine, jsPDF, xlsx'],
        ['AdminPanel', 'Container', 'Admin tab navigation', 'app-store'],
        ['AdminUsers', 'Admin', 'User CRUD', 'fazai-db'],
        ['AdminAccounts', 'Admin', 'Account CRUD', 'fazai-db, ledger-engine'],
        ['AdminCustomEntry', 'Admin', 'Custom journal entry', 'ledger-engine, fazai-db'],
        ['AdminBackup', 'Admin', 'Data export/import/reset', 'fazai-db'],
        ['AdminSettings', 'Admin', 'Admin preferences', 'auth-store, fazai-db'],
        ['AiChat', 'Overlay', 'AI assistant panel', 'z-ai-web-dev-sdk, fazai-db'],
        ['BottomNav', 'Navigation', 'Tab navigation bar', 'auth-store, app-store'],
        ['UserGuide', 'Overlay', 'Help documentation', 'i18n'],
    ]
    story.extend(build_table(comp_headers, comp_rows, [0.18, 0.10, 0.32, 0.40],
                             'Table 11: Component Architecture'))

    comp_comm = (
        "Component communication in FAZAI follows a hybrid pattern combining Zustand global stores "
        "with local component state. The auth-store provides authentication context (user ID, role, "
        "language) to all components that need it, while the app-store controls navigation by exposing "
        "the currentPage and navigate() function. Components do not communicate directly with each "
        "other; instead, they read from shared stores and emit state changes that trigger re-renders "
        "in dependent components."
    )
    story.append(Paragraph(comp_comm, style_body))

    comp_comm2 = (
        "Data loading follows a useRef-based load-once pattern: each component maintains a loadRef "
        "flag that prevents duplicate database queries on re-render. When a component mounts, it checks "
        "if loadRef.current is false, queries Dexie for its required data, sets the local state, and "
        "flips the flag to true. This pattern is simple but has a notable limitation: there is no "
        "shared data cache, meaning six or more components independently load the accounts table, "
        "causing redundant IndexedDB reads. A future optimization would involve creating a shared "
        "data cache layer in Zustand that all components subscribe to."
    )
    story.append(Paragraph(comp_comm2, style_body))

    # ── Section 9: Data Flow Architecture ────────────────────────────────
    story.append(add_heading('<b>9. Data Flow Architecture</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    df_text1 = (
        "<b>User Input Flow:</b> When a user performs an action such as recording a transaction, the flow "
        "follows this path: User action triggers a component event handler, which calls the ledger-engine "
        "module for business logic validation (e.g., double-entry balance check). The ledger-engine then "
        "persists the transaction via Dexie.js to IndexedDB. After the write completes, the component "
        "re-queries the database to refresh its local state, causing a re-render with the updated data."
    )
    story.append(Paragraph(df_text1, style_body))

    df_text2 = (
        "<b>Report Generation Flow:</b> When a user selects a reporting period, the getPeriodDates() "
        "utility computes the start and end dates for the requested period. The ledger-engine then queries "
        "the AccountMonthlySummary table for completed months and performs a live transaction scan for "
        "the current month (MTD). These two result sets are merged to produce the final report data, "
        "which the ReportViewer component renders as an HTML table. Optionally, the user can export the "
        "report to PDF via jsPDF or to XLSX via the xlsx library, both of which operate entirely "
        "client-side."
    )
    story.append(Paragraph(df_text2, style_body))

    df_text3 = (
        "<b>AI Chat Flow:</b> When a user sends a message to the AI assistant, the client first gathers "
        "financial context from Dexie, including account balances, recent transactions, and monthly "
        "summaries. This context is formatted by the /api/ai/context endpoint and sent along with the "
        "user's message to /api/ai/chat. The LLM processes the request and returns a response that may "
        "contain an action directive (create transaction, delete transaction, or query result). The client "
        "parses the response, executes any actions locally against Dexie via the ledger-engine, and "
        "displays the result to the user. The entire flow is stateless from the server's perspective: "
        "the server has no knowledge of the user's financial data beyond what is sent in each request."
    )
    story.append(Paragraph(df_text3, style_body))

    df_text4 = (
        "<b>Startup Flow:</b> When the application loads, Dexie opens the IndexedDB database and the "
        "seedDatabase() function checks whether the database is empty. If it is, the default chart of "
        "accounts and admin user are created. Next, runStartupMaintenance() executes two critical "
        "operations: (1) the monthly summary rollover, which finalizes AccountMonthlySummary records "
        "for any months that have elapsed since the last startup, and (2) the archive process, which "
        "moves transactions older than 6 months to the ArchivedTransaction table. After maintenance "
        "completes, the PIN login screen is displayed."
    )
    story.append(Paragraph(df_text4, style_body))

    df_text5 = (
        "<b>Monthly Summary Strategy:</b> The hybrid approach to monthly reporting is central to FAZAI's "
        "performance. Past months use pre-calculated AccountMonthlySummary records that store totalDebit "
        "and totalCredit per account per month. These summaries are calculated once when the month ends "
        "and are never recalculated unless the user restores a backup. The current month, however, uses "
        "live transaction scanning to compute Month-to-Date (MTD) figures. This ensures that the current "
        "month's reports always reflect the latest data without requiring a summary recalculation after "
        "every transaction."
    )
    story.append(Paragraph(df_text5, style_body))

    # ── Section 10: State Management Architecture ────────────────────────
    story.append(add_heading('<b>10. State Management Architecture</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    sm_text1 = (
        "<b>auth-store (Zustand):</b> The authentication store manages the following state: isAuthenticated "
        "(boolean), userId (string), userName (string), userRole (admin | user), and lang (en | id | zh). "
        "Its actions include login(userId, pin) which validates credentials against Dexie, logout() which "
        "clears the auth state, and setLang(lang) which persists the language preference to localStorage "
        "for cross-session consistency. The auth-store is the single source of truth for who is currently "
        "using the application."
    )
    story.append(Paragraph(sm_text1, style_body))

    sm_text2 = (
        "<b>app-store (Zustand):</b> The application store controls client-side routing with the following "
        "state: currentPage (string identifying the active screen), previousPage (string for back navigation), "
        "reportType (string identifying the selected report type), and selectedTransactionId (string for "
        "drill-down navigation). Its primary action, navigate(page), updates currentPage and shifts the "
        "current page to previousPage. The setReportType(type) action is called when a user selects a "
        "report from the Reports screen before navigating to the ReportViewer."
    )
    story.append(Paragraph(sm_text2, style_body))

    sm_text3 = (
        "<b>Local State (useState):</b> Each component manages its own data independently using React's "
        "useState hook. There is no global data cache: each component queries Dexie directly when it "
        "mounts. This means that the accounts table, for example, is loaded separately by the "
        "TransactionForm, Dashboard, AdminAccounts, AdminCustomEntry, and ReportViewer components. "
        "While this approach is simple and avoids cache invalidation complexity, it results in "
        "redundant IndexedDB reads and potential inconsistencies if one component modifies data that "
        "another component has already loaded."
    )
    story.append(Paragraph(sm_text3, style_body))

    sm_text4 = (
        "<b>Data Loading Pattern:</b> The useRef-based load-once pattern prevents duplicate database "
        "queries on component re-render. Each component declares a loadRef = useRef(false) and checks "
        "it in a useEffect before querying Dexie. After the data is loaded and local state is set, "
        "loadRef.current is set to true. This pattern works correctly but does not handle cases where "
        "data changes in another component (e.g., a new account added in AdminAccounts is not reflected "
        "in TransactionForm until the page is reloaded). A shared data cache in Zustand would resolve "
        "this limitation."
    )
    story.append(Paragraph(sm_text4, style_body))

    # ── Section 11: API Architecture ─────────────────────────────────────
    story.append(add_heading('<b>11. API Architecture</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    api_headers = ['Endpoint', 'Method', 'Purpose', 'Auth', 'Input', 'Output']
    api_rows = [
        ['/api/ai/chat', 'POST', 'LLM chat completion', 'None', '{ messages, context, action }', '{ content, action }'],
        ['/api/ai/context', 'POST', 'Format financial context', 'None', '{ accounts, transactions, summaries, dashboard }', '{ context }'],
        ['/api/ai/suggest', 'POST', 'Account suggestion', 'None', '{ keyword, accounts }', '{ suggestions }'],
    ]
    story.extend(build_table(api_headers, api_rows, [0.14, 0.08, 0.18, 0.08, 0.26, 0.26],
                             'Table 12: API Endpoints'))

    api_text1 = (
        "The API architecture of FAZAI reflects its client-heavy design philosophy. Unlike traditional "
        "three-tier architectures where the server is the data authority, FAZAI's API endpoints serve as "
        "thin processing layers that transform client-provided data rather than query a server-side "
        "database. Financial data is sent from the client to the API, not fetched from the server. "
        "This means the /api/ai/chat endpoint receives the user's financial context (accounts, "
        "transactions, summaries) as part of the request payload, formats it for the LLM, and returns "
        "the model's response without storing any data server-side."
    )
    story.append(Paragraph(api_text1, style_body))

    api_text2 = (
        "The /api/ai/suggest endpoint performs simple keyword matching against the account list to "
        "suggest accounts for transaction entry (e.g., typing 'coffee' suggests 'Food & Beverages'). "
        "This could theoretically be done client-side, but the current implementation routes it through "
        "an API for consistency with the LLM interaction pattern. The /api/ai/context endpoint formats "
        "raw financial data into a structured context string suitable for LLM consumption, handling "
        "number formatting, currency symbols, and date localization. None of the three endpoints "
        "require authentication, which is a known security gap documented in Section 12."
    )
    story.append(Paragraph(api_text2, style_body))

    # ── Section 12: Security Architecture ────────────────────────────────
    story.append(add_heading('<b>12. Security Architecture</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    sec_text1 = (
        "<b>Current State:</b> FAZAI's security model is minimal, reflecting its design as a personal, "
        "single-device application. The 6-digit PIN is stored in plaintext within IndexedDB, meaning "
        "that anyone with access to the browser's developer tools can read all user credentials. "
        "Authentication state is stored in localStorage with no session tokens or expiration. API "
        "endpoints have no authentication whatsoever: any client that can reach the server can invoke "
        "the AI chat, context formatting, and suggestion endpoints. There is no CSRF protection, no "
        "rate limiting on PIN attempts, and no encryption of IndexedDB data at rest."
    )
    story.append(Paragraph(sec_text1, style_body))

    sec_text2 = (
        "<b>Planned Improvements:</b> The security roadmap includes several critical enhancements. First, "
        "PIN hashing with bcrypt or argon2 to prevent credential exposure even if IndexedDB is compromised. "
        "Second, session token generation upon successful PIN validation, with configurable expiration "
        "and refresh mechanics. Third, API authentication middleware that validates session tokens on "
        "every request. Fourth, rate limiting on PIN attempts (e.g., 5 attempts per minute) to prevent "
        "brute-force attacks. Fifth, encryption of sensitive IndexedDB data at rest using the Web "
        "Cryptography API, with the encryption key derived from the user's PIN."
    )
    story.append(Paragraph(sec_text2, style_body))

    sec_text3 = (
        "<b>Risk Assessment:</b> The current security posture is suitable for personal single-device use "
        "where the primary threat model is casual snooping rather than targeted attack. The PIN provides "
        "a basic access control mechanism that prevents incidental access by other household members. "
        "However, FAZAI in its current state is not suitable for shared devices or multi-user production "
        "environments without significant security hardening. The absence of server-side validation means "
        "that a compromised client could inject arbitrary transactions, and the lack of audit logging "
        "makes it impossible to detect unauthorized modifications after the fact."
    )
    story.append(Paragraph(sec_text3, style_body))

    # ── Section 13: Deployment Architecture ──────────────────────────────
    story.append(add_heading('<b>13. Deployment Architecture</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    deploy_text1 = (
        "FAZAI is deployed behind a Caddy reverse proxy listening on port 81, which forwards requests to "
        "the Next.js application running on port 3000. The public domain is fazai.space-z.ai, with Caddy "
        "handling TLS termination and automatic HTTPS certificate management. The Next.js application is "
        "built using next build with standalone output mode and runs on the Bun runtime for improved "
        "startup performance."
    )
    story.append(Paragraph(deploy_text1, style_body))

    deploy_text2 = (
        "The PWA configuration includes a manifest.json with standalone display mode, a theme color "
        "matching the application's accent color, and icon definitions for various screen densities. "
        "This enables the add-to-homescreen functionality on both Android Chrome and iOS Safari. "
        "Currently, there is no CI/CD pipeline configured: deployments are performed manually by running "
        "next build and restarting the application process. There is no containerization (Docker) and no "
        "monitoring or error tracking infrastructure. Application health is monitored only through manual "
        "verification and the Caddy access logs."
    )
    story.append(Paragraph(deploy_text2, style_body))

    # ── Section 14: Technology Stack Decision Record ─────────────────────
    story.append(add_heading('<b>14. Technology Stack Decision Record</b>', style_h1, level=0))
    story.append(Spacer(1, 6))

    tech_headers = ['Decision', 'Choice', 'Rationale', 'Trade-off']
    tech_rows = [
        ['Framework', 'Next.js 16', 'PWA support, React ecosystem', 'Overkill for SPA - no SSR used'],
        ['Database', 'Dexie/IndexedDB', 'Offline-first, zero infra cost', 'No server sync, browser-dependent'],
        ['State', 'Zustand', 'Lightweight, simple API', 'No DevTools like Redux'],
        ['UI', 'shadcn/ui + Radix', 'Accessible primitives, customizable', 'Large dependency count'],
        ['AI', 'z-ai-web-dev-sdk', 'Integrated LLM access', 'Vendor lock-in'],
        ['Auth', 'Custom PIN', 'Simple, offline-capable', 'No real security'],
        ['Export', 'jsPDF + xlsx', 'Client-side generation', 'xlsx has CVE concerns'],
        ['Build', 'Turbopack', 'Fast dev server', 'New, some edge cases'],
    ]
    story.extend(build_table(tech_headers, tech_rows, [0.14, 0.18, 0.34, 0.34],
                             'Table 13: Technology Stack Decision Record'))

    tech_summary = (
        "Each technology decision in FAZAI was driven by the application's core requirements of simplicity, "
        "offline capability, and zero infrastructure cost. The most significant trade-off is the choice of "
        "Next.js as the framework: while it provides excellent PWA support and the React ecosystem, "
        "FAZAI does not use server-side rendering, API routes for data, or dynamic routing, making Next.js "
        "functionally equivalent to a Create React App setup with additional complexity. The Dexie/IndexedDB "
        "choice enables true offline operation but introduces data fragility, as browser data clearing "
        "results in permanent data loss without a backup. The xlsx library for Excel export carries known "
        "CVE vulnerabilities, and a migration to a safer alternative such as ExcelJS is recommended for "
        "production use."
    )
    story.append(Paragraph(tech_summary, style_body))

    # ── Build the document ───────────────────────────────────────────────
    doc.multiBuild(story, onFirstPage=on_page_first, onLaterPages=on_page)


# ══════════════════════════════════════════════════════════════════════════
# COVER GENERATION
# ══════════════════════════════════════════════════════════════════════════
def generate_cover():
    """Generate cover HTML and render to PDF via html2poster.js."""
    # Write cover HTML
    with open(COVER_HTML, 'w', encoding='utf-8') as f:
        f.write(COVER_HTML_CONTENT)

    # Validate cover HTML
    print("[1/4] Validating cover HTML...")
    result = subprocess.run(
        ['python3', os.path.join(PDF_SKILL_DIR, 'scripts', 'poster_validate.py'),
         'check-html', COVER_HTML],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("Cover validation warnings (non-blocking):")
        print(result.stdout)
    else:
        print("Cover HTML validation passed.")

    # Validate cover overlap
    print("[2/4] Validating cover overlap...")
    result2 = subprocess.run(
        ['node', os.path.join(PDF_SKILL_DIR, 'scripts', 'cover_validate.js'), COVER_HTML],
        capture_output=True, text=True
    )
    if result2.returncode != 0:
        print("Cover overlap validation warnings:")
        print(result2.stdout)
    else:
        print("Cover overlap validation passed.")

    # Render cover to PDF via html2poster.js
    print("[3/4] Rendering cover to PDF...")
    subprocess.run([
        'node', os.path.join(PDF_SKILL_DIR, 'scripts', 'html2poster.js'),
        COVER_HTML, '--output', COVER_PDF, '--width', '794px'
    ], check=True)
    print(f"Cover PDF saved to {COVER_PDF}")


# ══════════════════════════════════════════════════════════════════════════
# MERGE COVER + BODY
# ══════════════════════════════════════════════════════════════════════════
A4_W, A4_H = 595.28, 841.89

def normalize_page_to_a4(page):
    """Scale a page to A4 if its dimensions don't match."""
    from pypdf import Transformation
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    # Always normalize to exact A4
    if abs(w - A4_W) > 0.5 or abs(h - A4_H) > 0.5:
        sx, sy = A4_W / w, A4_H / h
        page.add_transformation(Transformation().scale(sx=sx, sy=sy))
    page.mediabox.lower_left = (0, 0)
    page.mediabox.upper_right = (A4_W, A4_H)
    return page

def merge_pdfs():
    """Merge cover PDF + body PDF into final output."""
    from pypdf import PdfReader, PdfWriter

    print("[4/4] Merging cover + body PDFs...")
    writer = PdfWriter()

    # Cover as page 1
    cover_page = PdfReader(COVER_PDF).pages[0]
    writer.add_page(normalize_page_to_a4(cover_page))

    # Body pages follow
    for page in PdfReader(BODY_PDF).pages:
        writer.add_page(normalize_page_to_a4(page))

    writer.add_metadata({
        '/Title': 'FAZAI PRD & Architecture Flow',
        '/Author': 'Z.ai',
        '/Creator': 'Z.ai',
        '/Subject': 'Product Requirements Document and Architecture Flow for FAZAI Accounting PWA',
    })

    with open(FINAL_PDF, 'wb') as f:
        writer.write(f)

    print(f"Final PDF saved to {FINAL_PDF}")


# ══════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    print("=" * 60)
    print("FAZAI PRD & Architecture Flow - PDF Generator")
    print("=" * 60)

    # Step 1: Generate cover
    generate_cover()

    # Step 2: Build body PDF
    print("\nBuilding body PDF...")
    build_body()
    print(f"Body PDF saved to {BODY_PDF}")

    # Step 3: Merge
    merge_pdfs()

    # Cleanup temp files
    for f in [COVER_HTML, COVER_PDF, BODY_PDF]:
        if os.path.exists(f):
            os.remove(f)
            print(f"Cleaned up: {f}")

    # Report
    import os
    size = os.path.getsize(FINAL_PDF)
    from pypdf import PdfReader
    pages = len(PdfReader(FINAL_PDF).pages)
    print(f"\n{'=' * 60}")
    print(f"DELIVERY SUMMARY")
    print(f"{'=' * 60}")
    print(f"File:     {FINAL_PDF}")
    print(f"Size:     {size / 1024:.1f} KB")
    print(f"Pages:    {pages}")
    print(f"{'=' * 60}")
