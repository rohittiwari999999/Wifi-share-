package com.wifishare.local.ui.transfer

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.wifishare.local.data.model.TransferProgress
import com.wifishare.local.data.model.TransferState

@Composable
fun TransferScreen(
    progress: TransferProgress?,
    onCancelTransfer: () -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (progress == null) {
            Text(
                text = "No active transfer.",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onBackground
            )
            return@Column
        }

        val percentage = if (progress.totalBytes > 0) {
            ((progress.bytesTransferred.toDouble() / progress.totalBytes) * 100).toInt()
        } else 0

        val speedMb = "%.2f".format(progress.bytesPerSecond / (1024.0 * 1024.0))
        val transferredMb = "%.2f".format(progress.bytesTransferred / (1024.0 * 1024.0))
        val totalMb = "%.2f".format(progress.totalBytes / (1024.0 * 1024.0))

        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Status Icon
                when (progress.state) {
                    TransferState.IN_PROGRESS -> {
                        CircularProgressIndicator(
                            progress = { percentage / 100f },
                            modifier = Modifier.size(72.dp),
                            strokeWidth = 6.dp
                        )
                    }
                    TransferState.COMPLETED -> {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Completed",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(72.dp)
                        )
                    }
                    TransferState.PENDING_APPROVAL -> {
                        CircularProgressIndicator(modifier = Modifier.size(72.dp))
                    }
                    TransferState.FAILED, TransferState.REJECTED -> {
                        Icon(
                            imageVector = Icons.Default.Error,
                            contentDescription = "Failed",
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(72.dp)
                        )
                    }
                    TransferState.CANCELLED -> {
                        Icon(
                            imageVector = Icons.Default.Cancel,
                            contentDescription = "Cancelled",
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(72.dp)
                        )
                    }
                    else -> {}
                }

                Text(
                    text = when (progress.state) {
                        TransferState.PENDING_APPROVAL -> "Waiting for receiver approval..."
                        TransferState.IN_PROGRESS -> "Transferring: ${progress.fileName}"
                        TransferState.COMPLETED -> "Transfer Complete!"
                        TransferState.REJECTED -> "Transfer was rejected by receiver"
                        TransferState.FAILED -> "Transfer failed: ${progress.errorMessage ?: "Unknown error"}"
                        TransferState.CANCELLED -> "Transfer cancelled"
                        else -> "Processing..."
                    },
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (progress.state == TransferState.IN_PROGRESS) {
                    LinearProgressIndicator(
                        progress = { percentage / 100f },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "$percentage% ($transferredMb / $totalMb MB)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                        )
                        Text(
                            text = "$speedMb MB/s · ETA: ${progress.estimatedRemainingSeconds}s",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                        )
                    }

                    Text(
                        text = "File ${progress.currentFileIndex} of ${progress.totalFiles}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                if (progress.state == TransferState.IN_PROGRESS || progress.state == TransferState.PENDING_APPROVAL) {
                    OutlinedButton(
                        onClick = onCancelTransfer,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Cancel Transfer")
                    }
                } else {
                    Button(onClick = onDone) {
                        Text("Done")
                    }
                }
            }
        }
    }
}
