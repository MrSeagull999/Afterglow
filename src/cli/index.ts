#!/usr/bin/env node

import { Command } from 'commander'
import { config } from 'dotenv'
import { scanDirectory } from '../main/core/fileScan'
import { getPresets, getPreset } from '../main/core/promptBank'
import { createRun, getRun, listRuns, getApprovedImages, updateImageStatus } from '../main/core/runStore'
import { generatePreview, generatePreviewBatch } from '../main/core/gemini/previewGenerate'
import { submitBatch } from '../main/core/gemini/batchSubmit'
import { pollBatchUntilComplete } from '../main/core/gemini/batchPoll'
import { fetchBatchResults } from '../main/core/gemini/batchFetch'
import { basename } from 'path'

config()

const program = new Command()

program
  .name('afterglow')
  .description('CLI for AfterGlow twilight photo conversion')
  .version('1.0.0')

program
  .command('presets')
  .description('List available presets')
  .action(async () => {
    try {
      const presets = await getPresets()
      console.log('\nAvailable Presets:\n')
      presets.forEach(preset => {
        console.log(`  ${preset.id}`)
        console.log(`    Label: ${preset.label}`)
        console.log(`    Description: ${preset.description}`)
        console.log()
      })
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('preview')
  .description('Generate preview images for a listing folder')
  .requiredOption('-i, --input <dir>', 'Input directory containing images')
  .requiredOption('-p, --preset <presetId>', 'Preset ID to use')
  .option('-f, --format <format>', 'Output format (png or jpg)', 'png')
  .option('--force', 'Force regeneration of existing previews')
  .action(async (options) => {
    try {
      console.log(`\nScanning ${options.input}...`)
      const images = await scanDirectory(options.input)
      
      if (images.length === 0) {
        console.log('No images found in the specified directory.')
        process.exit(0)
      }
      
      console.log(`Found ${images.length} images`)
      
      const preset = await getPreset(options.preset)
      if (!preset) {
        console.error(`Preset not found: ${options.preset}`)
        process.exit(1)
      }
      
      const listingName = basename(options.input)
      const imageEntries = images.map(img => ({
        path: img.path,
        name: img.name,
        status: 'pending' as const,
        presetId: options.preset
      }))
      
      console.log(`\nCreating run for "${listingName}"...`)
      const run = await createRun({
        inputDir: options.input,
        listingName,
        images: imageEntries,
        defaultPresetId: options.preset
      })
      
      console.log(`Run ID: ${run.id}`)
      console.log(`\nGenerating previews with preset "${preset.label}"...\n`)
      
      const imagesToProcess = run.images.map(img => ({
        path: img.path,
        presetId: img.presetId
      }))
      
      let completed = 0
      const results = await generatePreviewBatch(
        { runId: run.id, images: imagesToProcess },
        (imagePath, progress, result) => {
          if (result) {
            completed++
            const status = result.success ? '✓' : '✗'
            console.log(`[${completed}/${images.length}] ${status} ${basename(imagePath)}`)
            if (result.error) {
              console.log(`    Error: ${result.error}`)
            }
          }
        }
      )
      
      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length
      
      console.log(`\nPreview generation complete!`)
      console.log(`  Successful: ${successful}`)
      console.log(`  Failed: ${failed}`)
      console.log(`  Output: ${run.outputDir}/_previews/`)
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('finalize')
  .description('Generate final 4K images for approved images in a run')
  .requiredOption('-r, --run <runId>', 'Run ID to finalize')
  .option('--batch', 'Use batch mode for cost savings')
  .option('--force', 'Force regeneration of existing finals')
  .action(async (options) => {
    try {
      const run = await getRun(options.run)
      if (!run) {
        console.error(`Run not found: ${options.run}`)
        process.exit(1)
      }
      
      const approved = await getApprovedImages(options.run)
      if (approved.length === 0) {
        console.log('No approved images to finalize.')
        console.log('Use the desktop app to approve images first.')
        process.exit(0)
      }
      
      console.log(`\nFinalizing ${approved.length} approved images...`)
      console.log(`Run: ${run.listingName}`)
      
      if (options.batch) {
        console.log('\nSubmitting batch job...')
        const submitResult = await submitBatch(options.run, (progress) => {
          console.log(`  ${progress.stage}: ${progress.current}/${progress.total}`)
        })
        
        if (!submitResult.success) {
          console.error(`Batch submission failed: ${submitResult.error}`)
          process.exit(1)
        }
        
        console.log(`\nBatch submitted: ${submitResult.batchId}`)
        console.log('Polling for completion (this may take a while)...\n')
        
        const pollResult = await pollBatchUntilComplete(
          options.run,
          submitResult.batchId!,
          (status) => {
            console.log(`  Status: ${status.state}${status.progress ? ` (${status.progress}%)` : ''}`)
          }
        )
        
        if (pollResult.status.state !== 'SUCCEEDED') {
          console.error(`Batch failed: ${pollResult.status.state}`)
          process.exit(1)
        }
        
        console.log('\nFetching results...')
        const fetchResult = await fetchBatchResults(
          options.run,
          submitResult.batchId!,
          (imagePath, progress) => {
            console.log(`  [${Math.round(progress)}%] ${basename(imagePath)}`)
          }
        )
        
        console.log(`\nFinalization complete!`)
        console.log(`  Processed: ${fetchResult.processedCount}`)
        console.log(`  Failed: ${fetchResult.failedCount}`)
        console.log(`  Output: ${run.outputDir}/`)
        
      } else {
        console.log('\nNote: For cost savings, use --batch flag for batch processing.')
        console.log('Non-batch finalization not implemented in CLI.')
        console.log('Use the desktop app for non-batch finalization.')
      }
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Check the status of a run')
  .requiredOption('-r, --run <runId>', 'Run ID to check')
  .action(async (options) => {
    try {
      const run = await getRun(options.run)
      if (!run) {
        console.error(`Run not found: ${options.run}`)
        process.exit(1)
      }
      
      const counts = {
        pending: run.images.filter(i => i.status === 'pending').length,
        preview_ready: run.images.filter(i => i.status === 'preview_ready').length,
        approved: run.images.filter(i => i.status === 'approved').length,
        final_ready: run.images.filter(i => i.status === 'final_ready').length,
        error: run.images.filter(i => i.status === 'error').length
      }
      
      console.log(`\nRun: ${run.id}`)
      console.log(`Listing: ${run.listingName}`)
      console.log(`Input: ${run.inputDir}`)
      console.log(`Output: ${run.outputDir}`)
      console.log(`Created: ${run.createdAt}`)
      console.log(`\nImage Status:`)
      console.log(`  Total: ${run.images.length}`)
      console.log(`  Pending: ${counts.pending}`)
      console.log(`  Preview Ready: ${counts.preview_ready}`)
      console.log(`  Approved: ${counts.approved}`)
      console.log(`  Final Ready: ${counts.final_ready}`)
      console.log(`  Errors: ${counts.error}`)
      
      if (run.batchId) {
        console.log(`\nBatch Info:`)
        console.log(`  Batch ID: ${run.batchId}`)
        console.log(`  Status: ${run.batchStatus || 'unknown'}`)
      }
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('fetch')
  .description('Fetch results from a completed batch job')
  .requiredOption('-r, --run <runId>', 'Run ID to fetch results for')
  .action(async (options) => {
    try {
      const run = await getRun(options.run)
      if (!run) {
        console.error(`Run not found: ${options.run}`)
        process.exit(1)
      }
      
      if (!run.batchId) {
        console.error('No batch job found for this run.')
        process.exit(1)
      }
      
      console.log(`\nFetching results for batch ${run.batchId}...`)
      
      const fetchResult = await fetchBatchResults(
        options.run,
        run.batchId,
        (imagePath, progress) => {
          console.log(`  [${Math.round(progress)}%] ${basename(imagePath)}`)
        }
      )
      
      console.log(`\nFetch complete!`)
      console.log(`  Processed: ${fetchResult.processedCount}`)
      console.log(`  Failed: ${fetchResult.failedCount}`)
      console.log(`  Output: ${run.outputDir}/`)
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('runs')
  .description('List all runs')
  .action(async () => {
    try {
      const runs = await listRuns()
      
      if (runs.length === 0) {
        console.log('\nNo runs found.')
        return
      }
      
      console.log('\nRecent Runs:\n')
      runs.forEach(run => {
        const approved = run.images.filter(i => i.status === 'approved').length
        const finalReady = run.images.filter(i => i.status === 'final_ready').length
        console.log(`  ${run.id}`)
        console.log(`    Listing: ${run.listingName}`)
        console.log(`    Images: ${run.images.length} (${approved} approved, ${finalReady} finalized)`)
        console.log(`    Created: ${run.createdAt}`)
        console.log()
      })
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program.parse()
