"""Logging configuration"""

import logging

# Logger configuration
logging.basicConfig(level=logging.INFO, format="%(levelname)s:  [%(name)s] %(message)s")
logger = logging.getLogger(__name__)
