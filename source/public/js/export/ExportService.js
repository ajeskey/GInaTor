/**
 * ExportService — export visualizations as PNG, SVG, or PDF.
 * Uses html2canvas for PNG, SVG serialization, and jsPDF for PDF.
 * Requirements: 37.1–37.8
 */
(function () {
  'use strict';

  /**
   * Export the current visualization as PNG.
   * @param {HTMLElement} container - the viz container element
   * @param {object} [meta] - { title, dateRange, repoName }
   */
  function exportPNG(container, meta) {
    if (!container) return;
    if (typeof window.html2canvas !== 'function') {
      console.warn('ExportService: html2canvas not loaded');
      return;
    }

    var wrapper = _wrapWithHeader(container, meta);
    window.html2canvas(wrapper, { useCORS: true, backgroundColor: null }).then(function (canvas) {
      _cleanupWrapper(wrapper, container);
      var link = document.createElement('a');
      link.download = _filename(meta, 'png');
      link.href = canvas.toDataURL('image/png');
      link.click();
    }).catch(function (err) {
      _cleanupWrapper(wrapper, container);
      console.error('ExportService PNG error:', err);
    });
  }

  /**
   * Export the current visualization as SVG.
   * @param {HTMLElement} container - the viz container element
   * @param {object} [meta] - { title, dateRange, repoName }
   */
  function exportSVG(container, meta) {
    if (!container) return;

    var svgEl = container.querySelector('svg');
    if (!svgEl) {
      console.warn('ExportService: No SVG element found in container');
      return;
    }

    // Clone SVG and add header text
    var clone = svgEl.cloneNode(true);
    var headerText = _headerString(meta);
    if (headerText) {
      var textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textEl.setAttribute('x', '10');
      textEl.setAttribute('y', '16');
      textEl.setAttribute('font-size', '14');
      textEl.setAttribute('font-family', 'sans-serif');
      textEl.setAttribute('fill', '#333');
      textEl.textContent = headerText;
      clone.insertBefore(textEl, clone.firstChild);
    }

    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(clone);
    var blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var link = document.createElement('a');
    link.download = _filename(meta, 'svg');
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export the current visualization as PDF.
   * @param {HTMLElement} container - the viz container element
   * @param {object} [meta] - { title, dateRange, repoName }
   */
  function exportPDF(container, meta) {
    if (!container) return;
    if (typeof window.html2canvas !== 'function') {
      console.warn('ExportService: html2canvas not loaded');
      return;
    }
    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
      console.warn('ExportService: jsPDF not loaded');
      return;
    }

    var wrapper = _wrapWithHeader(container, meta);
    window.html2canvas(wrapper, { useCORS: true, backgroundColor: '#ffffff' }).then(function (canvas) {
      _cleanupWrapper(wrapper, container);
      var jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
      var pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
      var pageWidth = pdf.internal.pageSize.getWidth();
      var pageHeight = pdf.internal.pageSize.getHeight();
      var imgRatio = canvas.width / canvas.height;
      var pdfWidth = pageWidth - 40;
      var pdfHeight = pdfWidth / imgRatio;
      if (pdfHeight > pageHeight - 40) {
        pdfHeight = pageHeight - 40;
        pdfWidth = pdfHeight * imgRatio;
      }
      var imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 20, 20, pdfWidth, pdfHeight);
      pdf.save(_filename(meta, 'pdf'));
    }).catch(function (err) {
      _cleanupWrapper(wrapper, container);
      console.error('ExportService PDF error:', err);
    });
  }

  /**
   * Build a header string from metadata.
   * @param {object} [meta]
   * @returns {string}
   * @private
   */
  function _headerString(meta) {
    if (!meta) return '';
    var parts = [];
    if (meta.title) parts.push(meta.title);
    if (meta.repoName) parts.push(meta.repoName);
    if (meta.dateRange) {
      var dr = meta.dateRange;
      if (dr.from || dr.to) {
        parts.push((dr.from || '?') + ' – ' + (dr.to || '?'));
      }
    }
    return parts.join(' | ');
  }

  /**
   * Wrap container with a header div for export.
   * @param {HTMLElement} container
   * @param {object} [meta]
   * @returns {HTMLElement} wrapper
   * @private
   */
  function _wrapWithHeader(container, meta) {
    var headerText = _headerString(meta);
    var wrapper = document.createElement('div');
    wrapper.style.background = '#ffffff';
    wrapper.style.padding = '16px';

    if (headerText) {
      var header = document.createElement('div');
      header.style.fontSize = '16px';
      header.style.fontWeight = 'bold';
      header.style.marginBottom = '12px';
      header.style.color = '#333';
      header.textContent = headerText;
      wrapper.appendChild(header);
    }

    // Clone the container content
    var clone = container.cloneNode(true);
    wrapper.appendChild(clone);

    // Temporarily add to DOM for html2canvas
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    document.body.appendChild(wrapper);
    return wrapper;
  }

  /**
   * Clean up the temporary wrapper.
   * @param {HTMLElement} wrapper
   * @param {HTMLElement} container
   * @private
   */
  function _cleanupWrapper(wrapper, container) {
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
  }

  /**
   * Generate a filename for export.
   * @param {object} [meta]
   * @param {string} ext
   * @returns {string}
   * @private
   */
  function _filename(meta, ext) {
    var name = 'ginator-export';
    if (meta && meta.title) {
      name = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    }
    return name + '.' + ext;
  }

  // Expose globally
  window.ExportService = {
    exportPNG: exportPNG,
    exportSVG: exportSVG,
    exportPDF: exportPDF
  };
})();
