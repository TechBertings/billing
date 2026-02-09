import React from 'react';
import Status from './InvoicesByStatus';
import { FaFileAlt } from 'react-icons/fa';

const DraftInvoices = () => {
    return (
        <Status
            statusFilter="draft"
            title="Draft Invoices"
            icon={FaFileAlt}
            color="from-gray-500 to-slate-600"
        />
    );
};

export default DraftInvoices;