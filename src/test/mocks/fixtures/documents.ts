import type { DocumentInput, Chunk } from "@/lib/types";

// Sample documents for testing
export const sampleDocuments: DocumentInput[] = [
  {
    id: "contract-1",
    text: `MASTER SERVICES AGREEMENT

This Master Services Agreement ("Agreement") is entered into as of January 1, 2024, by and between:

Acme Corporation ("Client"), a Delaware corporation with its principal place of business at 123 Main Street, New York, NY 10001, and

TechServices Inc. ("Provider"), a California corporation with its principal place of business at 456 Oak Avenue, San Francisco, CA 94102.

1. SERVICES
The Provider agrees to provide software development and consulting services as described in each Statement of Work ("SOW") executed under this Agreement.

2. TERM
This Agreement shall commence on the Effective Date and continue for a period of two (2) years, unless terminated earlier in accordance with Section 8.

3. COMPENSATION
Client shall pay Provider the fees set forth in each applicable SOW. Payment terms are Net 30 from invoice date.

4. INTELLECTUAL PROPERTY
All work product created by Provider specifically for Client under this Agreement shall be owned by Client upon full payment.

5. CONFIDENTIALITY
Each party agrees to maintain the confidentiality of the other party's Confidential Information for a period of five (5) years.

6. LIMITATION OF LIABILITY
Neither party shall be liable for indirect, incidental, or consequential damages exceeding the fees paid in the prior twelve (12) months.

7. INDEMNIFICATION
Provider shall indemnify Client against third-party claims arising from Provider's negligence or willful misconduct.

8. TERMINATION
Either party may terminate this Agreement with 30 days written notice. Upon termination, all outstanding fees become due.`,
  },
  {
    id: "policy-1",
    text: `DATA PRIVACY POLICY

Effective Date: March 1, 2024
Last Updated: March 15, 2024

1. INTRODUCTION
This Data Privacy Policy describes how we collect, use, and protect personal information.

2. INFORMATION WE COLLECT
We collect the following categories of personal information:
- Contact information (name, email, phone)
- Usage data (browsing history, interaction logs)
- Device information (IP address, browser type)

3. HOW WE USE INFORMATION
We use collected information to:
- Provide and improve our services
- Communicate with users
- Comply with legal obligations

4. DATA RETENTION
We retain personal data for as long as necessary to fulfill the purposes outlined in this policy.

5. USER RIGHTS
Users have the right to:
- Access their personal data
- Request deletion of their data
- Opt out of marketing communications

6. SECURITY MEASURES
We implement industry-standard security measures including encryption and access controls.

7. CONTACT
For privacy inquiries, contact: privacy@example.com`,
  },
];

// Short document for simple tests
export const shortDocument: DocumentInput = {
  id: "short-doc",
  text: "This is a short test document with minimal content.",
};

// Long document that will create multiple chunks
export const longDocument: DocumentInput = {
  id: "long-doc",
  text: Array(20)
    .fill(null)
    .map(
      (_, i) =>
        `Section ${i + 1}\n\nThis is paragraph ${i + 1} of the long document. ` +
        `It contains enough text to test chunking behavior. ` +
        `The chunking algorithm should split this into multiple chunks based on size limits. ` +
        `Each section represents distinct content that may be relevant to different queries.`
    )
    .join("\n\n"),
};

// Empty document for edge case testing
export const emptyDocument: DocumentInput = {
  id: "empty-doc",
  text: "",
};

// Document with special characters
export const specialCharDocument: DocumentInput = {
  id: "special-chars",
  text: `Document with special characters: "quotes", 'apostrophes', <tags>, & ampersands.

Unicode: 日本語 中文 한국어 العربية

Code block:
\`\`\`javascript
const x = () => console.log("test");
\`\`\`

Markdown: **bold**, *italic*, [link](url)`,
};

// Sample chunks for retrieval testing
export const sampleChunks: Chunk[] = [
  {
    id: "doc-1-chunk-1",
    docId: "contract-1",
    index: 0,
    text: "This is the first chunk about services and agreements.",
    start: 0,
    end: 500,
  },
  {
    id: "doc-1-chunk-2",
    docId: "contract-1",
    index: 1,
    text: "Payment terms are Net 30. Compensation is defined in each SOW.",
    start: 500,
    end: 1000,
  },
  {
    id: "doc-1-chunk-3",
    docId: "contract-1",
    index: 2,
    text: "Intellectual property ownership transfers upon full payment.",
    start: 1000,
    end: 1500,
  },
  {
    id: "doc-2-chunk-1",
    docId: "policy-1",
    index: 0,
    text: "Privacy policy describes data collection and usage practices.",
    start: 0,
    end: 400,
  },
  {
    id: "doc-2-chunk-2",
    docId: "policy-1",
    index: 1,
    text: "Users have rights to access and delete their personal data.",
    start: 400,
    end: 800,
  },
];

// Sample questions for testing
export const sampleQuestions = {
  general: "Summarize the key points of these documents.",
  specific: "What are the payment terms?",
  comparison: "Compare the liability provisions across documents.",
  missing: "What is the warranty period?",
};
